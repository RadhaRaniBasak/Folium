import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateJWT } from '../../middleware/authenticateJWT';
import { handle } from '../../middleware/handle';
import { createUpload, MAX_BYTES, saveLocal, UPLOAD_DIR } from './uploads.service';

const router = Router();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env['UPLOAD_RATE_LIMIT'] ?? 200),
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/uploads',
  limiter,
  authenticateJWT,
  handle((userId, _p, req) => createUpload(userId, req.body ?? {}), 201),
);
router.put(
  '/uploads/local/:key',
  limiter,
  authenticateJWT,
  express.raw({ type: () => true, limit: MAX_BYTES }),
  handle((userId, { key }, req) =>
    saveLocal(userId, key!, req.headers['content-type'], req.body as Buffer),
  ),
);

/** Local uploads, served as plain files that never run as pages. */
export const serveUploads = express.static(UPLOAD_DIR, {
  immutable: true,
  maxAge: '365d',
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  },
});

export default router;
