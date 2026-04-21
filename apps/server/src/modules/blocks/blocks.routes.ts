import { Router } from 'express';
import { authenticateJWT } from '../../middleware/authenticateJWT';
import { createBlockHandler, listBlocksHandler } from './blocks.controller';

const router = Router();
router.use(authenticateJWT);

// NOTE: controller will check membership via page.workspace
router.post('/pages/:pageId/blocks', createBlockHandler);
router.get('/pages/:pageId/blocks', listBlocksHandler);

export default router;
