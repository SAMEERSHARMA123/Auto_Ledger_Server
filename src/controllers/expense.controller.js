import Expense from '../models/Expense.js';
import DebtAccount from '../models/debt.js';
import mongoose from 'mongoose';

function normalizeProofUrl(rawProof) {
  if (typeof rawProof !== 'string') return undefined;
  const trimmed = rawProof.trim();
  if (!trimmed) return '';
  // Data URL (captured/uploaded image) ya valid URL/path dono support
  if (trimmed.startsWith('data:image/') || /^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) {
    return trimmed;
  }
  return undefined;
}

// 1. Add New Expense
export const addExpense = async (req, res) => {
  try {
    const { amount, type, category, paymentMethod, date, notes, isDebtRelated, receiptUrl, proof } =
      req.body;

    if (!amount || !category) {
      return res.status(400).json({ message: 'Amount and category are required' });
    }

    const normalizedProof = normalizeProofUrl(receiptUrl ?? proof);

    const expense = await Expense.create({
      userId: req.user.id,
      amount,
      type,
      category,
      paymentMethod,
      date: date || Date.now(),
      notes,
      isDebtRelated,
      ...(normalizedProof !== undefined ? { receiptUrl: normalizedProof } : {}),
    });

    res.status(201).json({ message: 'Expense added successfully', expense });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2. Get Paginated Expenses with Aggregation Pipeline (Advanced)
export const getPaginatedExpenses = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const pipeline = [
      {
        $match: { userId: new mongoose.Types.ObjectId(req.user.id) },
      },
      {
        $sort: { date: -1, _id: -1 },
      },
      {
        $facet: {
          metadata: [{ $count: 'totalRecords' }],
          records: [{ $skip: skip }, { $limit: limit }],
        },
      },
    ];

    const result = await Expense.aggregate(pipeline);

    const totalRecords = result[0].metadata[0]?.totalRecords || 0;
    const totalPages = Math.ceil(totalRecords / limit);

    res.status(200).json({
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      data: result[0].records,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getExpenses = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      paymentMethod,
      category,
      minAmount,
      maxAmount,
      startDate,
      endDate,
      proofStatus,
    } = req.query;

    const conditions = [{ userId: req.user.id }];

    if (search && search.trim()) {
      const regex = { $regex: search.trim(), $options: 'i' };
      conditions.push({ $or: [{ notes: regex }, { category: regex }] });
    }

    if (paymentMethod && paymentMethod !== 'ALL') {
      conditions.push({ paymentMethod: paymentMethod.toUpperCase() });
    }

    if (category && category !== 'ALL') {
      conditions.push({ category: category.toUpperCase() });
    }

    if (minAmount !== undefined && minAmount !== '') {
      conditions.push({ amount: { $gte: Number(minAmount) } });
    }

    if (maxAmount !== undefined && maxAmount !== '') {
      conditions.push({ amount: { $lte: Number(maxAmount) } });
    }

    if (startDate) {
      conditions.push({ date: { $gte: new Date(startDate) } });
    }

    if (endDate) {
      conditions.push({ date: { $lte: new Date(endDate) } });
    }

    if (proofStatus === 'PROOF') {
      conditions.push({ receiptUrl: { $exists: true, $nin: ['', null] } });
    } else if (proofStatus === 'NO_PROOF') {
      conditions.push({
        $or: [{ receiptUrl: { $exists: false } }, { receiptUrl: '' }, { receiptUrl: null }],
      });
    }

    const filter = { $and: conditions };
    const skip = (Number(page) - 1) * Number(limit);

    const [expenses, total] = await Promise.all([
      Expense.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(Number(limit)),
      Expense.countDocuments(filter),
    ]);

    res.status(200).json({
      data: expenses,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. Edit / Update Expense (with optional proof / image upload)
export const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      amount,
      type,
      category,
      paymentMethod,
      date,
      notes,
      isDebtRelated,
      receiptUrl,
      proof,
      removeProof,
    } = req.body;

    const updates = {};
    if (amount !== undefined) updates.amount = Number(amount);
    if (type !== undefined) updates.type = type;
    if (category !== undefined) updates.category = category;
    if (paymentMethod !== undefined) updates.paymentMethod = paymentMethod;
    if (date !== undefined) updates.date = new Date(date);
    if (notes !== undefined) updates.notes = notes;
    if (isDebtRelated !== undefined) updates.isDebtRelated = Boolean(isDebtRelated);

    if (removeProof) {
      updates.receiptUrl = '';
    } else {
      const normalizedProof = normalizeProofUrl(receiptUrl ?? proof);
      if (normalizedProof !== undefined) {
        updates.receiptUrl = normalizedProof;
      }
    }

    const expense = await Expense.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found or unauthorized' });
    }

    res.status(200).json({ message: 'Expense updated successfully', expense });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const editExpense = updateExpense;

// 4. Reset All Expenses & Debts for Current User
export const resetAllData = async (req, res) => {
  try {
    const userId = req.user.id;

    await Promise.all([
      Expense.deleteMany({ userId }),
      DebtAccount.deleteMany({ userId }),
    ]);

    res.status(200).json({ message: 'All expenses and debts reset successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 5. Delete Expense
export const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findOneAndDelete({
      _id: id,
      userId: req.user.id,
    });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found or unauthorized' });
    }

    res.status(200).json({ message: 'Expense deleted successfully', id: expense._id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};