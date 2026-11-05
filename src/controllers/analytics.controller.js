import Expense from '../models/Expense.js';
import mongoose from 'mongoose';

export const getDashboardSummary = async (req, res) => {
    try {
        // Is mahine ki 1st date aur aakhri date nikalna
        const date = new Date();
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        const pipeline = [
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(req.user.id),
                    date: { $gte: firstDay, $lte: lastDay } // Sirf is mahine ka data
                }
            },
            {
                $facet: {
                    // 1. Total Income aur Total Expense calculate karna
                    totals: [
                        {
                            $group: {
                                _id: null,
                                totalExpense: {
                                    $sum: { $cond: [{ $eq: ['$type', 'EXPENSE'] }, '$amount', 0] }
                                },
                                totalIncome: {
                                    $sum: { $cond: [{ $eq: ['$type', 'INCOME'] }, '$amount', 0] }
                                }
                            }
                        }
                    ],
                    // 2. Category ke hisaab se kharcha nikalna (Pie chart ke liye)
                    categoryBreakdown: [
                        { $match: { type: 'EXPENSE' } },
                        {
                            $group: {
                                _id: '$category',
                                amount: { $sum: '$amount' }
                            }
                        },
                        { $sort: { amount: -1 } } // Sabse zyada kharcha upar
                    ]
                }
            }
        ];

        const result = await Expense.aggregate(pipeline);

        const summary = {
            totals: result[0].totals[0] || { totalExpense: 0, totalIncome: 0 },
            categoryBreakdown: result[0].categoryBreakdown
        };

        res.status(200).json({ summary });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};