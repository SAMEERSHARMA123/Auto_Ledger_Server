import Expense from '../models/Expense.js';
import DebtAccount from '../models/debt.js';
import mongoose from 'mongoose';

// 1. Add New Expense
export const addExpense = async (req, res) => {
    try {
        const { amount, type, category, paymentMethod, date, notes, isDebtRelated } = req.body;

        if (!amount || !category) {
            return res.status(400).json({ message: 'Amount and category are required' });
        }

        const expense = await Expense.create({
            userId: req.user.id, // Middleware se aayega
            amount,
            type,
            category,
            paymentMethod,
            date: date || Date.now(),
            notes,
            isDebtRelated
        });

        res.status(201).json({ message: 'Expense added successfully', expense });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 2. Get Paginated Expenses with Aggregation Pipeline (Advanced)
export const getPaginatedExpenses = async (req, res) => {
    try {
        // URL Query se page aur limit nikalna (e.g., ?page=1&limit=10)
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const pipeline = [
            {
                $match: { userId: new mongoose.Types.ObjectId(req.user.id) }
            },
            {
                $sort: { date: -1, _id: -1 } // Latest pehle
            },
            {
                $facet: {
                    // Metadata array: total records aur calculations
                    metadata: [
                        { $count: 'totalRecords' }
                    ],
                    // Actual data array with pagination limit
                    records: [
                        { $skip: skip },
                        { $limit: limit }
                    ]
                }
            }
        ];

        const result = await Expense.aggregate(pipeline);

        // Response formatting
        const totalRecords = result[0].metadata[0]?.totalRecords || 0;
        const totalPages = Math.ceil(totalRecords / limit);

        res.status(200).json({
            pagination: {
                currentPage: page,
                totalPages,
                totalRecords,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            },
            data: result[0].records
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

// 3. Reset All Expenses & Debts for Current User
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

// 4. Delete Expense
export const deleteExpense = async (req, res) => {
    try {
        const { id } = req.params;

        const expense = await Expense.findOneAndDelete({
            _id: id,
            userId: req.user.id // Ensure user can only delete their own data
        });

        if (!expense) {
            return res.status(404).json({ message: 'Expense not found or unauthorized' });
        }

        res.status(200).json({ message: 'Expense deleted successfully', id: expense._id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};