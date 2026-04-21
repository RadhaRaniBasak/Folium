import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../errors/AppError';
import * as service from './pages.service';

export async function createPageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError('Unauthorized', 401);
    const { workspaceId } = req.params as { workspaceId: string };
    const { title, parent } = req.body as { title?: string; parent?: string | null };
    if (!title) throw new AppError('title is required', 400);

    const page = await service.createPage(workspaceId, title, parent ?? null);
    res.status(201).json({ success: true, data: { page } });
  } catch (err) {
    next(err);
  }
}

export async function listPagesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { workspaceId } = req.params as { workspaceId: string };
    const pages = await service.listPages(workspaceId);
    res.status(200).json({ success: true, data: { pages } });
  } catch (err) {
    next(err);
  }
}
