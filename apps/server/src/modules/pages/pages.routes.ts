import { Router } from 'express';
import { authenticateJWT } from '../../middleware/authenticateJWT';
import { requireWorkspaceRole } from '../../middleware/requireWorkspaceRole';
import {
  createPageHandler,
  listPagesHandler,
} from './pages.controller';

const router = Router();
router.use(authenticateJWT);

router.post(
  '/workspaces/:workspaceId/pages',
  requireWorkspaceRole(['owner', 'editor']),
  createPageHandler,
);

router.get(
  '/workspaces/:workspaceId/pages',
  requireWorkspaceRole(['owner', 'editor', 'viewer']),
  listPagesHandler,
);

export default router;
