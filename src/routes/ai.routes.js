import express from 'express';
import { protectRoute } from '../middleware/auth.middleware.js';
import { parseTextExpense, getAiAdvisor } from '../controllers/ai.controller.js';

const router = express.Router();

router.use(protectRoute); 

router.post('/parse-text', parseTextExpense);
router.get('/advisor', getAiAdvisor);

export default router;