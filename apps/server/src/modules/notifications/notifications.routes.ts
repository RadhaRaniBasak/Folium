import { Router } from 'express';
import { authenticateJWT } from '../../middleware/authenticateJWT';
import { handle } from '../../middleware/handle';
import { listNotifications, markRead } from './notifications.service';

const router = Router();
router.use(authenticateJWT);

router.get(
  '/notifications',
  handle((userId) => listNotifications(userId)),
);
// `{ ids }` marks those as read; no ids marks everything.
router.post(
  '/notifications/read',
  handle((userId, _params, req) => markRead(userId, (req.body as { ids?: unknown })?.ids)),
);

export default router;
