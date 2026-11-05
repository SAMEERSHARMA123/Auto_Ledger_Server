import Debt from '../models/debt.js';
import mongoose from 'mongoose';

// 1. Add New Debt (Naya Udhaar Record Karna)
export const addDebt = async (req, res) => {
    try {
        const { personName, type, principalAmount, dueDate, notes } = req.body;

        if (!personName || !type || !principalAmount) {
            return res.status(400).json({ message: 'Name, type, and amount are required' });
        }

        const debt = await Debt.create({
            userId: req.user.id,
            personName,
            type,
            principalAmount,
            remainingAmount: principalAmount, // Shuru mein remaining amount original ke barabar hoga
            dueDate,
            notes
        });

        res.status(201).json({ message: 'Debt added successfully', debt });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 2. Add Settlement (Partial ya Full Payment Record Karna)
export const addSettlement = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, notes } = req.body;

        const debt = await Debt.findOne({ _id: id, userId: req.user.id });
        if (!debt) return res.status(404).json({ message: 'Debt not found' });
        if (debt.status === 'SETTLED') return res.status(400).json({ message: 'Already settled' });

        if (amount > debt.remainingAmount) {
            return res.status(400).json({ message: 'Settlement amount cannot be greater than remaining amount' });
        }

        // Update remaining amount aur settlements array mein history push karna
        debt.remainingAmount -= amount;
        debt.status = debt.remainingAmount === 0 ? 'SETTLED' : 'PARTIALLY_PAID';
        debt.settlements.push({ amount, notes });

        await debt.save();

        res.status(200).json({ message: 'Settlement added successfully', debt });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 3. Get Complex Debt Summary (Kisse kitna lena/dena hai - Net Balance)
export const getDebtSummary = async (req, res) => {
    try {
        const pipeline = [
            {
                // Sirf current user ke pending/partially paid udhaar nikalo
                $match: {
                    userId: new mongoose.Types.ObjectId(req.user.id),
                    status: { $in: ['PENDING', 'PARTIALLY_PAID'] }
                }
            },
            {
                // Person ke naam se group karo aur total LENT / BORROWED calculate karo
                $group: {
                    _id: '$personName',
                    totalLent: {
                        $sum: { $cond: [{ $eq: ['$type', 'LENT'] }, '$remainingAmount', 0] }
                    },
                    totalBorrowed: {
                        $sum: { $cond: [{ $eq: ['$type', 'BORROWED'] }, '$remainingAmount', 0] }
                    }
                }
            },
            {
                // Net balance nikalo
                $project: {
                    personName: '$_id',
                    totalLent: 1,
                    totalBorrowed: 1,
                    netBalance: { $subtract: ['$totalLent', '$totalBorrowed'] }, // Positive = Woh aapko denge, Negative = Aap unko denge
                    _id: 0
                }
            },
            {
                $sort: { netBalance: -1 } // Jisse sabse zyada lena hai, woh sabse upar
            }
        ];

        const summary = await Debt.aggregate(pipeline);

        res.status(200).json({ summary });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};