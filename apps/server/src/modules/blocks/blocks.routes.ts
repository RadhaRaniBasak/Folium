import { Router } from 'express';
import { authenticateJWT } from '../../middleware/authenticateJWT';
import { createBlockHandler, listBlocksHandler, replaceBlocksHandler } from './blocks.controller';

const router = Router();
router.use(authenticateJWT);

// NOTE: the service checks membership via page.workspace
router.post('/pages/:pageId/blocks', createBlockHandler);
router.get('/pages/:pageId/blocks', listBlocksHandler);
// Replaces all blocks with the editor's current document (autosaved snapshot)
router.put('/pages/:pageId/blocks', replaceBlocksHandler);

export default router;
