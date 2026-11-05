import express from 'express';
import { protectRoute } from '../middleware/auth.middleware.js';
import { addDebt, addSettlement, getDebtSummary } from '../controllers/debt.controller.js';

const router = express.Router();

router.use(protectRoute); // Require token for all debt routes

router.post('/', addDebt);
router.post('/:id/settle', addSettlement);
router.get('/summary', getDebtSummary);

export default router;