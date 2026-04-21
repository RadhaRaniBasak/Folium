import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AppError } from '../errors/AppError';
import { Workspace, WorkspaceRole } from '../models/Workspace.model';

export function requireWorkspaceRole(allowed: WorkspaceRole[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError('Unauthorized', 401);

      const workspaceId =
        (req.params['workspaceId'] as string | undefined) ||
        (req.body?.workspaceId as string | undefined);

      if (!workspaceId || !Types.ObjectId.isValid(workspaceId)) {
        throw new AppError('workspaceId is required', 400);
      }

      const ws = await Workspace.findById(workspaceId);
      if (!ws) throw new AppError('Workspace not found', 404);

      const userId = req.user.userId;

      // owner has full access
      if (String(ws.owner) === userId) return next();

      const member = ws.members.find((m) => String(m.user) === userId);
      if (!member) throw new AppError('Forbidden — not a workspace member', 403);

      if (!allowed.includes(member.role)) {
        throw new AppError('Forbidden — insufficient role', 403);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
