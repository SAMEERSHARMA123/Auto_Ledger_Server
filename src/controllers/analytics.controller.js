import Expense from '../models/Expense.js';
import mongoose from 'mongoose';

export const getDashboardSummary = async (req, res) => {
    try {
        const date = new Date();
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

        const pipeline = [
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(req.user.id),
                    date: { $gte: firstDay, $lte: lastDay }
                }
            },
            {
                $facet: {
                    // 1. Total Income, Total Expense & Active Debts
                    totals: [
                        {
                            $group: {
                                _id: null,
                                totalExpense: {
                                    $sum: {
                                        $cond: [{ $eq: [{ $toUpper: '$type' }, 'EXPENSE'] }, '$amount', 0]
                                    }
                                },
                                totalIncome: {
                                    $sum: {
                                        $cond: [{ $eq: [{ $toUpper: '$type' }, 'INCOME'] }, '$amount', 0]
                                    }
                                },
                                activeDebts: {
                                    $sum: {
                                        $cond: [{ $eq: ['$isDebtRelated', true] }, '$amount', 0]
                                    }
                                }
                            }
                        }
                    ],
                    // 2. Category Breakdown (Donut Chart & Top Drain के लिए)
                    categoryBreakdown: [
                        { $match: { type: { $regex: /^expense$/i } } },
                        {
                            $group: {
                                _id: '$category',
                                amount: { $sum: '$amount' }
                            }
                        },
                        { $sort: { amount: -1 } }
                    ]
                }
            }
        ];

        const result = await Expense.aggregate(pipeline);
        const totalsData = result[0].totals[0] || { totalExpense: 0, totalIncome: 0, activeDebts: 0 };

        const summary = {
            netBalance: totalsData.totalIncome - totalsData.totalExpense,
            monthlyInflow: totalsData.totalIncome,
            monthlyOutflow: totalsData.totalExpense,
            activeDebts: totalsData.activeDebts,
            categoryBreakdown: result[0].categoryBreakdown
        };

        res.status(200).json({ summary });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getLedgerSummary = async (req, res) => {
  try {
    const { search, paymentMethod, category, minAmount, maxAmount, startDate, endDate } = req.query;

    // 1. Dynamic Match Filter
    const matchStage = {
      userId: new mongoose.Types.ObjectId(req.user.id),
      type: { $regex: /^expense$/i },
    };

    if (search?.trim()) {
      matchStage.$or = [
        { notes: { $regex: search.trim(), $options: 'i' } },
        { category: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    if (paymentMethod && paymentMethod !== 'ALL') {
      matchStage.paymentMethod = paymentMethod.toUpperCase();
    }

    if (category && category !== 'ALL') {
      matchStage.category = category.toUpperCase();
    }

    if (minAmount || maxAmount) {
      matchStage.amount = {};
      if (minAmount) matchStage.amount.$gte = Number(minAmount);
      if (maxAmount) matchStage.amount.$lte = Number(maxAmount);
    }

    if (startDate || endDate) {
      matchStage.date = {};
      if (startDate) matchStage.date.$gte = new Date(startDate);
      if (endDate) matchStage.date.$lte = new Date(endDate);
    }

    // 2. Single-Query Aggregation using $facet
    const [result] = await Expense.aggregate([
      { $match: matchStage },
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
    ]);

    const stats = result?.stats[0] || { filteredTotal: 0, itemCount: 0, averageSpend: 0 };
    const highest = result?.highest[0] || { amount: 0, category: 'NONE' };

    res.status(200).json({
      summary: {
        filteredTotal: stats.filteredTotal,
        itemCount: stats.itemCount,
        highestExpense: highest,
        averageSpend: Number(stats.averageSpend.toFixed(2)),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
