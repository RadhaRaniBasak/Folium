import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../errors/AppError';
import * as service from './blocks.service';

export async function createBlockHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError('Unauthorized', 401);
    const { pageId } = req.params as { pageId: string };

    const { type, props, parentBlock, order } = req.body as {
      type?: string;
      props?: Record<string, unknown>;
      parentBlock?: string | null;
      order?: number;
    };

    if (!type) throw new AppError('type is required', 400);

    const block = await service.createBlock({
      userId: req.user.userId,
      pageId,
      type,
      props: props ?? {},
      parentBlock: parentBlock ?? null,
      order: typeof order === 'number' ? order : 0,
    });

    res.status(201).json({ success: true, data: { block } });
  } catch (err) {
    next(err);
  }
}

export async function listBlocksHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError('Unauthorized', 401);
    const { pageId } = req.params as { pageId: string };
    const parentBlock = (req.query['parentBlock'] as string | undefined) ?? null;

    const blocks = await service.listBlocks({
      userId: req.user.userId,
      pageId,
      parentBlock,
    });

    res.status(200).json({ success: true, data: { blocks } });
  } catch (err) {
    next(err);
  }
}
