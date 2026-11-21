import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { PublicPage } from '@repo/shared';
import { AppError } from '../../errors/AppError';
import { Page } from '../../models/Page.model';
import { documentOf } from '../blocks/blocks.service';

/** Pages published to the web: read-only, no account needed, found only by their token. */
const router = Router();

router.get(
  '/public/:token',
  rateLimit({ windowMs: 60 * 1000, max: Number(process.env['PUBLIC_RATE_LIMIT'] ?? 120) }),
  async (req, res, next) => {
    try {
      const token = req.params['token'] ?? '';
      const page = /^[A-Za-z0-9_-]{16,64}$/.test(token)
        ? await Page.findOne({ shareToken: token, deletedAt: null })
        : null;
      if (!page) throw new AppError('This page isn’t published', 404);
      const data: PublicPage = {
        page: {
          title: page.title ?? '',
          icon: page.icon ?? null,
          coverImage: page.coverImage ?? null,
          font: page.font ?? 'sans',
          fullWidth: Boolean(page.fullWidth),
          updatedAt: page.updatedAt.toISOString(),
        },
        blocks: await documentOf(page._id as never),
      };
      res.setHeader('Cache-Control', 'no-store');
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
