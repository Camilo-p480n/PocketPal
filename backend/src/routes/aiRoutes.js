// src/routes/aiRoutes.js
import { Router } from 'express';
import { chat, getChatHistory, clearChatHistory } from '../controllers/aiController.js';
import { protect } from '../middleware/authMiddleware.js';
import { aiLimiter } from '../middleware/rateLimiter.js';
import { validate, rules } from '../middleware/validate.js';

const router = Router();

router.use(protect);

router.post('/chat', aiLimiter, validate(rules.ai.chat), chat);
router.get('/history', getChatHistory);
router.delete('/history', clearChatHistory);

export default router;