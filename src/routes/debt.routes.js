import express from 'express';
import { protectRoute } from '../middleware/auth.middleware.js';
import {
  getDebtsOverview,
  addDebtRecord,
  partialSettleEntry,
  settleFullAccount,
} from '../controllers/debt.controller.js';

const router = express.Router();

router.use(protectRoute);

router.get('/', getDebtsOverview);
router.post('/', addDebtRecord);
router.patch('/:accountId/entries/:entryId/partial', partialSettleEntry);
router.patch('/:accountId/settle', settleFullAccount);

export default router;