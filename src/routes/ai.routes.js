import express from 'express';
import { protectRoute } from '../middleware/auth.middleware.js';
import { logVoiceExpense } from '../controllers/ai.controller.js';

const router = express.Router();

router.use(protectRoute);

router.post('/voice-expense', logVoiceExpense);

export default router;