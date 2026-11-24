import express from 'express';
import { protectRoute } from '../middleware/auth.middleware.js';
import { generateWeeklySummary, logVoiceExpense } from '../controllers/ai.controller.js';

const router = express.Router();

router.use(protectRoute);

router.post('/voice-expense', logVoiceExpense);
router.post("/weekly-summary", protectRoute, generateWeeklySummary);

export default router;