import { Router } from 'express';
import { authenticateJWT } from '../../middleware/authenticateJWT';
import { handle } from '../../middleware/handle';
import { pushPublicKey } from './delivery';
import { listUpcoming, sendTest, subscribePush, unsubscribePush } from './reminders.service';

const router = Router();
router.use(authenticateJWT);

router.get(
  '/reminders',
  handle(async (userId) => ({ reminders: await listUpcoming(userId) })),
);
router.get(
  '/push/key',
  handle(async () => ({ publicKey: pushPublicKey() })),
);
router.post(
  '/push/subscribe',
  handle((userId, _p, req) => subscribePush(userId, req.body as object)),
);
router.post(
  '/push/unsubscribe',
  handle((userId, _p, req) =>
    unsubscribePush(userId, (req.body as { endpoint?: unknown })?.endpoint),
  ),
);
router.post(
  '/push/test',
  handle((userId) => sendTest(userId)),
);

export default router;
