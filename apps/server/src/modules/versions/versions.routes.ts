import { Router } from 'express';
import { authenticateJWT } from '../../middleware/authenticateJWT';
import { handle } from '../../middleware/handle';
import * as service from './versions.service';

const router = Router();
router.use(authenticateJWT);

router.get(
  '/pages/:pageId/versions',
  handle((userId, { pageId }, req) =>
    service.listVersions(
      userId,
      pageId!,
      typeof req.query['cursor'] === 'string' ? req.query['cursor'] : undefined,
    ),
  ),
);
router.post(
  '/pages/:pageId/versions',
  handle((userId, { pageId }, req) => service.createVersion(userId, pageId!, req.body ?? {}), 201),
);
router.get(
  '/pages/:pageId/versions/:versionId',
  handle((userId, { pageId, versionId }) => service.getVersion(userId, pageId!, versionId!)),
);
router.patch(
  '/pages/:pageId/versions/:versionId',
  handle((userId, { pageId, versionId }, req) =>
    service.renameVersion(userId, pageId!, versionId!, (req.body as { name?: unknown })?.name),
  ),
);
router.delete(
  '/pages/:pageId/versions/:versionId',
  handle((userId, { pageId, versionId }) => service.deleteVersion(userId, pageId!, versionId!)),
);

export default router;
