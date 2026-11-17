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
