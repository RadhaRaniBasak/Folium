import { Router } from 'express';
import { authenticateJWT } from '../../middleware/authenticateJWT';
import { requireWorkspaceRole } from '../../middleware/requireWorkspaceRole';
import {
  createPageHandler,
  deletePageHandler,
  duplicatePageHandler,
  getPageHandler,
  listPagesHandler,
  restorePageHandler,
  searchPagesHandler,
  toggleFavoriteHandler,
  trashPageHandler,
  updatePageHandler,
} from './pages.controller';

const router = Router();
router.use(authenticateJWT);

const anyMember = requireWorkspaceRole(['owner', 'editor', 'viewer']);

router.post(
  '/workspaces/:workspaceId/pages',
  requireWorkspaceRole(['owner', 'editor']),
  createPageHandler,
);
// ?trash=1 lists pages in the trash
router.get('/workspaces/:workspaceId/pages', anyMember, listPagesHandler);
router.get('/workspaces/:workspaceId/search', anyMember, searchPagesHandler);

// Page-level routes resolve the workspace from the page and check the role in the service.
router.get('/pages/:pageId', getPageHandler);
router.patch('/pages/:pageId', updatePageHandler);
router.post('/pages/:pageId/favorite', toggleFavoriteHandler);
router.post('/pages/:pageId/duplicate', duplicatePageHandler);
router.post('/pages/:pageId/restore', restorePageHandler);
router.delete('/pages/:pageId', trashPageHandler);
router.delete('/pages/:pageId/permanent', deletePageHandler);

export default router;
