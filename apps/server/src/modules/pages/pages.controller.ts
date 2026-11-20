import { Request, Response, NextFunction, RequestHandler } from 'express';
import type { UpdatePageInput } from '@repo/shared';
import { AppError } from '../../errors/AppError';
import * as service from './pages.service';

type Params = { workspaceId?: string; pageId?: string };

/** Wraps a handler that needs the caller's id and responds with `{ success, data }`. */
function handle(
  fn: (userId: string, params: Params, req: Request) => Promise<unknown>,
  status = 200,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError('Unauthorized', 401);
      const data = await fn(req.user.userId, req.params as Params, req);
      res.status(status).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}

export const createPageHandler = handle(
  async (userId, { workspaceId }, req) => ({
    page: await service.createPage(userId, workspaceId!, req.body ?? {}),
  }),
  201,
);

export const listPagesHandler = handle(async (userId, { workspaceId }, req) => ({
  pages: await service.listPages(userId, workspaceId!, req.query['trash'] === '1'),
}));

export const searchPagesHandler = handle(async (_userId, { workspaceId }, req) => ({
  results: await service.searchPages(workspaceId!, String(req.query['q'] ?? '')),
}));

export const getPageHandler = handle((userId, { pageId }) => service.getPage(userId, pageId!));

export const updatePageHandler = handle(async (userId, { pageId }, req) => ({
  page: await service.updatePage(userId, pageId!, (req.body ?? {}) as UpdatePageInput),
}));

export const toggleFavoriteHandler = handle(async (userId, { pageId }) => ({
  page: await service.toggleFavorite(userId, pageId!),
}));

export const duplicatePageHandler = handle(
  async (userId, { pageId }) => ({ page: await service.duplicatePage(userId, pageId!) }),
  201,
);

export const trashPageHandler = handle((userId, { pageId }) => service.trashPage(userId, pageId!));

export const restorePageHandler = handle(async (userId, { pageId }) => ({
  page: await service.restorePage(userId, pageId!),
}));

export const deletePageHandler = handle((userId, { pageId }) =>
  service.deletePagePermanently(userId, pageId!),
);
