import express from 'express';
import { protectRoute } from '../middleware/auth.middleware.js';
import { addExpense, deleteExpense, getExpenses } from '../controllers/expense.controller.js';

const router = express.Router();

// Middleware applies to all routes below
router.use(protectRoute);

router.post('/', addExpense);
router.get('/', getExpenses);
router.delete('/:id', deleteExpense);

export default router;