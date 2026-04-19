import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateJWT } from '../../middleware/authenticateJWT';
import {
  registerHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
  meHandler,
} from './auth.controller';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute rate-limit window
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

const router = Router();

router.post('/register', authLimiter, registerHandler);
router.post('/login', authLimiter, loginHandler);
router.post('/refresh', authLimiter, refreshHandler);
router.post('/logout', authLimiter, logoutHandler);
router.get('/me', apiLimiter, authenticateJWT, meHandler);

export default router;
