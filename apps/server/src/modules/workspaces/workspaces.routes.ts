import { Router } from 'express';
import { authenticateJWT } from '../../middleware/authenticateJWT';
import { requireWorkspaceRole } from '../../middleware/requireWorkspaceRole';
import {
  createWorkspaceHandler,
  listMyWorkspacesHandler,
  getWorkspaceHandler,
  addMemberHandler,
  updateMemberRoleHandler,
  removeMemberHandler,
} from './workspaces.controller';

const router = Router();
router.use(authenticateJWT);

router.post('/', createWorkspaceHandler);
router.get('/', listMyWorkspacesHandler);

router.get('/:workspaceId', requireWorkspaceRole(['owner', 'editor', 'viewer']), getWorkspaceHandler);

router.post('/:workspaceId/members', requireWorkspaceRole(['owner']), addMemberHandler);
router.patch('/:workspaceId/members/:userId', requireWorkspaceRole(['owner']), updateMemberRoleHandler);
router.delete('/:workspaceId/members/:userId', requireWorkspaceRole(['owner']), removeMemberHandler);

export default router;
