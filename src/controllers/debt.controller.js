import mongoose from 'mongoose';
import DebtAccount from '../models/debt.js';

const buildOverviewPayload = (accounts) => {
  const now = new Date();
  let toReceiveTotal = 0;
  let toReceivePeople = 0;
  let toPayTotal = 0;
  let toPayPeople = 0;

  const toReceiveList = [];
  const toPayList = [];
  const settledHistory = [];

  for (const acc of accounts) {
    const activeEntries = acc.entries
      .filter((e) => e.status === 'ACTIVE' && e.remainingAmount > 0)
      .map((e) => ({
        _id: e._id,
        note: e.note,
        amount: e.remainingAmount,
        originalAmount: e.amount,
        date: e.date,
        isOverdue: Boolean(e.dueDate && new Date(e.dueDate) < now),
      }));

    const settledEntries = acc.entries
      .filter((e) => e.status === 'SETTLED')
      .map((e) => ({
        _id: e._id,
        personName: acc.personName,
        type: acc.type,
        note: e.note,
        amount: e.amount,
        date: e.date,
        settledAt: e.settledAt || e.updatedAt,
      }));

    settledHistory.push(...settledEntries);

    const personPending = activeEntries.reduce((sum, e) => sum + e.amount, 0);

    if (personPending > 0) {
      const cardData = {
        _id: acc._id,
        personName: acc.personName,
        type: acc.type,
        totalAmount: personPending,
        activeCount: activeEntries.length,
        entries: activeEntries,
      };

      if (acc.type === 'LENT') {
        toReceiveTotal += personPending;
        toReceivePeople += 1;
        toReceiveList.push(cardData);
      } else {
        toPayTotal += personPending;
        toPayPeople += 1;
        toPayList.push(cardData);
      }
    }
  }

  settledHistory.sort((a, b) => new Date(b.settledAt) - new Date(a.settledAt));

  return {
    banners: {
      toReceive: toReceiveTotal,
      toReceivePeople,
      toPay: toPayTotal,
      toPayPeople,
      netBalance: toReceiveTotal - toPayTotal,
    },
    toReceiveList,
    toPayList,
    settledHistory,
  };
};

// GET /api/debts
export const getDebtsOverview = async (req, res) => {
  try {
    const accounts = await DebtAccount.find({ userId: req.user.id }).sort({ updatedAt: -1 }).lean();
    const payload = buildOverviewPayload(accounts);
    res.status(200).json(payload);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/debts
export const addDebtRecord = async (req, res) => {
  try {
    const { personName, type, amount, note, reason, date, dueDate } = req.body;
    const cleanName = personName?.trim();
    const cleanType = type?.toUpperCase();
    const numericAmount = Number(amount);

    if (!cleanName) {
      return res.status(400).json({ message: 'Person name is required' });
    }
    if (!['LENT', 'BORROWED'].includes(cleanType)) {
      return res.status(400).json({ message: 'Type must be LENT or BORROWED' });
    }
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ message: 'Valid amount is required' });
    }

    const newEntry = {
      note: (note || reason || '').trim() || (cleanType === 'LENT' ? 'Lent Amount' : 'Borrowed Amount'),
      amount: numericAmount,
      remainingAmount: numericAmount,
      date: date ? new Date(date) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      status: 'ACTIVE',
    };

    let account = await DebtAccount.findOne({
      userId: req.user.id,
      personName: new RegExp(`^${cleanName}$`, 'i'),
      type: cleanType,
    });

    if (!account) {
      account = await DebtAccount.create({
        userId: req.user.id,
        personName: cleanName,
        type: cleanType,
        entries: [newEntry],
      });
    } else {
      account.entries.push(newEntry);
      await account.save();
    }

    const allAccounts = await DebtAccount.find({ userId: req.user.id }).sort({ updatedAt: -1 }).lean();
    res.status(201).json({
      message: 'Record added',
      account,
      ...buildOverviewPayload(allAccounts),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/debts/:accountId/entries/:entryId/partial
export const partialSettleEntry = async (req, res) => {
  try {
    const { accountId, entryId } = req.params;
    const paidAmount = Number(req.body.amount);

    if (!mongoose.Types.ObjectId.isValid(accountId) || !mongoose.Types.ObjectId.isValid(entryId)) {
      return res.status(400).json({ message: 'Invalid ID' });
    }
    if (!paidAmount || paidAmount <= 0) {
      return res.status(400).json({ message: 'Payment amount must be greater than 0' });
    }

    const account = await DebtAccount.findOne({ _id: accountId, userId: req.user.id });
    if (!account) {
      return res.status(404).json({ message: 'Record not found' });
    }

    const entry = account.entries.id(entryId);
    if (!entry || entry.status === 'SETTLED') {
      return res.status(404).json({ message: 'Active entry not found' });
    }
    if (paidAmount > entry.remainingAmount) {
      return res.status(400).json({
        message: `Amount exceeds remaining balance (₹${entry.remainingAmount})`,
      });
    }

    entry.remainingAmount -= paidAmount;
    if (entry.remainingAmount === 0) {
      entry.status = 'SETTLED';
      entry.settledAt = new Date();
    }

    await account.save();

    const allAccounts = await DebtAccount.find({ userId: req.user.id }).sort({ updatedAt: -1 }).lean();
    res.status(200).json({
      message: 'Partial payment recorded',
      ...buildOverviewPayload(allAccounts),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/debts/:accountId/settle
export const settleFullAccount = async (req, res) => {
  try {
    const { accountId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(accountId)) {
      return res.status(400).json({ message: 'Invalid account ID' });
    }

    const account = await DebtAccount.findOne({ _id: accountId, userId: req.user.id });
    if (!account) {
      return res.status(404).json({ message: 'Record not found' });
    }

    const settledNow = new Date();
    for (const entry of account.entries) {
      if (entry.status === 'ACTIVE') {
        entry.remainingAmount = 0;
        entry.status = 'SETTLED';
        entry.settledAt = settledNow;
      }
    }

    await account.save();

    const allAccounts = await DebtAccount.find({ userId: req.user.id }).sort({ updatedAt: -1 }).lean();
    res.status(200).json({
      message: 'Settled in full',
      ...buildOverviewPayload(allAccounts),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};