import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppError } from '../errors/AppError';

export type Params = Record<string, string | undefined>;

/** Wraps a handler that needs the caller's id and responds with `{ success, data }`. */
export function handle(
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
