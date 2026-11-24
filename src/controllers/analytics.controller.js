import Expense from '../models/Expense.js';
import mongoose from 'mongoose';
import DebtAccount from '../models/debt.js';

export const getDashboardSummary = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

    const pipeline = [
      {
        $match: {
          userId,
          date: { $gte: firstDay, $lte: lastDay },
        },
      },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalExpense: {
                  $sum: {
                    $cond: [{ $eq: [{ $toUpper: '$type' }, 'EXPENSE'] }, '$amount', 0],
                  },
                },
                totalIncome: {
                  $sum: {
                    $cond: [{ $eq: [{ $toUpper: '$type' }, 'INCOME'] }, '$amount', 0],
                  },
                },
              },
            },
          ],
          categoryBreakdown: [
            { $match: { type: { $regex: /^expense$/i } } },
            {
              $group: {
                _id: '$category',
                amount: { $sum: '$amount' },
              },
            },
            { $sort: { amount: -1 } },
          ],
        },
      },
    ];

    const [result, debtAccounts] = await Promise.all([
      Expense.aggregate(pipeline),
      DebtAccount.find({ userId }).lean(),
    ]);

    const totalsData = result[0]?.totals?.[0] || { totalExpense: 0, totalIncome: 0 };
    const activeDebts = debtAccounts.reduce(
      (sum, acc) =>
        sum +
        acc.entries
          .filter((e) => e.status === 'ACTIVE' && e.remainingAmount > 0)
          .reduce((accSum, e) => accSum + e.remainingAmount, 0),
      0
    );

    const summary = {
      netBalance: totalsData.totalIncome - totalsData.totalExpense,
      monthlyInflow: totalsData.totalIncome,
      monthlyOutflow: totalsData.totalExpense,
      activeDebts,
      categoryBreakdown: result[0]?.categoryBreakdown || [],
    };

    res.status(200).json({ summary });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getLedgerSummary = async (req, res) => {
  try {
    const { search, paymentMethod, category, minAmount, maxAmount, startDate, endDate } = req.query;

    const baseMatch = {
      userId: new mongoose.Types.ObjectId(req.user.id),
    };

    if (search?.trim()) {
      baseMatch.$or = [
        { notes: { $regex: search.trim(), $options: 'i' } },
        { category: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    if (paymentMethod && paymentMethod !== 'ALL') {
      baseMatch.paymentMethod = paymentMethod.toUpperCase();
    }

    if (category && category !== 'ALL') {
      baseMatch.category = category.toUpperCase();
    }

    if (minAmount || maxAmount) {
      baseMatch.amount = {};
      if (minAmount) baseMatch.amount.$gte = Number(minAmount);
      if (maxAmount) baseMatch.amount.$lte = Number(maxAmount);
    }

    if (startDate || endDate) {
      baseMatch.date = {};
      if (startDate) baseMatch.date.$gte = new Date(startDate);
      if (endDate) baseMatch.date.$lte = new Date(endDate);
    }

    const expenseMatch = {
      ...baseMatch,
      type: { $regex: /^expense$/i },
    };

    const incomeMatch = {
      ...baseMatch,
      type: { $regex: /^income$/i },
    };

    const [[expenseResult], [incomeResult]] = await Promise.all([
      Expense.aggregate([
        { $match: expenseMatch },
        {
          $facet: {
            stats: [
              {
                $group: {
                  _id: null,
                  filteredTotal: { $sum: '$amount' },
                  itemCount: { $sum: 1 },
                  averageSpend: { $avg: '$amount' },
                },
              },
            ],
            highest: [
              { $sort: { amount: -1 } },
              { $limit: 1 },
              { $project: { _id: 0, amount: 1, category: 1 } },
            ],
          },
        },
      ]),
      Expense.aggregate([
        { $match: incomeMatch },
        {
          $group: {
            _id: null,
            totalIncome: { $sum: '$amount' },
            incomeCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const stats = expenseResult?.stats[0] || { filteredTotal: 0, itemCount: 0, averageSpend: 0 };
    const highest = expenseResult?.highest[0] || { amount: 0, category: 'NONE' };
    const totalIncome = incomeResult?.totalIncome || 0;
    const incomeCount = incomeResult?.incomeCount || 0;

    res.status(200).json({
      summary: {
        filteredTotal: stats.filteredTotal,
        itemCount: stats.itemCount,
        highestExpense: highest,
        averageSpend: Number(stats.averageSpend.toFixed(2)),
        totalIncome,
        incomeCount,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getDashboardInsights = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const now = new Date();

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const daysInMonth = endOfMonth.getDate();
    const remainingDays = Math.max(1, daysInMonth - now.getDate() + 1);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [result] = await Expense.aggregate([
      { $match: { userId } },
      {
        $facet: {
          monthlyTotals: [
            { $match: { date: { $gte: startOfMonth, $lte: endOfMonth } } },
            {
              $group: {
                _id: { $toUpper: '$type' },
                total: { $sum: '$amount' },
              },
            },
          ],
          categoryBreakdown: [
            {
              $match: {
                type: { $regex: /^expense$/i },
                date: { $gte: startOfMonth, $lte: endOfMonth },
              },
            },
            {
              $group: {
                _id: '$category',
                amount: { $sum: '$amount' },
              },
            },
            { $sort: { amount: -1 } },
          ],
          pendingDebts: [
            { $match: { isDebtRelated: true } },
            { $count: 'count' },
          ],
          last7Days: [
            {
              $match: {
                type: { $regex: /^expense$/i },
                date: { $gte: sevenDaysAgo, $lte: now },
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$date',
                    timezone: 'Asia/Kolkata',
                  },
                },
                amount: { $sum: '$amount' },
              },
            },
          ],
        },
      },
    ]);

    const monthlyInflow = result.monthlyTotals.find((t) => t._id === 'INCOME')?.total || 0;
    const monthlyOutflow = result.monthlyTotals.find((t) => t._id === 'EXPENSE')?.total || 0;
    const remainingBudget = Math.max(0, monthlyInflow - monthlyOutflow);

    const burnRate = {
      dailySafeLimit: Math.round(remainingBudget / remainingDays),
      monthlyBurnPercent:
        monthlyInflow > 0
          ? Number(Math.min(100, (monthlyOutflow / monthlyInflow) * 100).toFixed(1))
          : 0,
    };

    const categories = result.categoryBreakdown || [];
    const totalCategorySpend = categories.reduce((sum, c) => sum + c.amount, 0);

    const categorySplit = categories.slice(0, 3).map((c) => ({
      category: c._id,
      amount: c.amount,
      percentage:
        totalCategorySpend > 0 ? Math.round((c.amount / totalCategorySpend) * 100) : 0,
    }));

    const topDrain = categorySplit[0] || { category: 'NONE', amount: 0, percentage: 0 };
    const pendingDebtsCount = result.pendingDebts[0]?.count || 0;

    const dayMap = new Map(result.last7Days.map((d) => [d._id, d.amount]));
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    const rawPulse = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sevenDaysAgo);
      d.setDate(sevenDaysAgo.getDate() + i);
      const dateKey = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      return {
        date: dateKey,
        day: dayNames[d.getDay()],
        amount: dayMap.get(dateKey) || 0,
      };
    });

    const maxDaySpend = Math.max(...rawPulse.map((d) => d.amount));

    const sevenDayPulse = rawPulse.map((item) => ({
      ...item,
      isHighest: maxDaySpend > 0 && item.amount === maxDaySpend,
    }));

    res.status(200).json({
      insights: {
        burnRate,
        topDrain,
        pendingDebtsCount,
        sevenDayPulse,
        categorySplit,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};