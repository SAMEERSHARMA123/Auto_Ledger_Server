import Expense from '../models/Expense.js';
import { parseExpenseWithAI, generateFinancialAdvice } from '../services/gemini.service.js';

export const parseTextExpense = async (req, res) => {
    try {
        const { text, autoSave } = req.body;

        if (!text) {
            return res.status(400).json({ message: 'Text input is required' });
        }

        // 1. Call our Gemini service
        const parsedData = await parseExpenseWithAI(text);

        // 2. If the user wants to auto-save directly to the database
        if (autoSave) {
            const newExpense = await Expense.create({
                userId: req.user.id,
                amount: parsedData.amount,
                type: parsedData.type,
                category: parsedData.category,
                paymentMethod: parsedData.paymentMethod,
                notes: parsedData.notes || text, // Fallback to original text if no notes
                isDebtRelated: parsedData.isDebtRelated
            });

            return res.status(201).json({ 
                message: 'Expense parsed and saved automatically', 
                expense: newExpense 
            });
        }

        // 3. Otherwise, just return the structured JSON so the frontend can preview it
        res.status(200).json({
            message: 'Expense parsed successfully',
            preview: parsedData
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getAiAdvisor = async (req, res) => {
    try {
        // 1. Get current month data (using same logic as analytics)
        const date = new Date();
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        const expenses = await Expense.aggregate([
            { $match: { userId: req.user.id, date: { $gte: firstDay, $lte: lastDay }, type: 'EXPENSE' } },
            { $group: { _id: '$category', total: { $sum: '$amount' } } }
        ]);

        if (expenses.length === 0) {
            return res.status(200).json({ advice: ["Not enough data this month to give advice. Start logging your expenses!"] });
        }

        // 2. Send to Gemini
        const adviceArray = await generateFinancialAdvice(expenses);

        res.status(200).json({ advice: adviceArray });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};