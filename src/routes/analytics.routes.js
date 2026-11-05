import express from 'express';
import { protectRoute } from '../middleware/auth.middleware.js';
import { getDashboardSummary } from '../controllers/analytics.controller.js';

const router = express.Router();
router.use(protectRoute);
router.get('/summary', getDashboardSummary);

export default router;