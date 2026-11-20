import express from 'express';
import { protectRoute } from '../middleware/auth.middleware.js';
import { getDashboardSummary, getLedgerSummary } from '../controllers/analytics.controller.js';

const router = express.Router();
router.use(protectRoute);
router.get('/summary', getDashboardSummary);
router.get('/ledger-summary', getLedgerSummary);

export default router;