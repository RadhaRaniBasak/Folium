import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../errors/AppError';
import * as service from './workspaces.service';

export async function createWorkspaceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError('Unauthorized', 401);
    const { name } = req.body as { name?: string };
    if (!name) throw new AppError('name is required', 400);

    const workspace = await service.createWorkspace(req.user.userId, name);
    res.status(201).json({ success: true, data: { workspace } });
  } catch (err) {
    next(err);
  }
}

export async function listMyWorkspacesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError('Unauthorized', 401);
    const workspaces = await service.listMyWorkspaces(req.user.userId);
    res.status(200).json({ success: true, data: { workspaces } });
  } catch (err) {
    next(err);
  }
}

export async function getWorkspaceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { workspaceId } = req.params as { workspaceId: string };
    const workspace = await service.getWorkspaceById(workspaceId);
    if (!workspace) throw new AppError('Workspace not found', 404);
    res.status(200).json({ success: true, data: { workspace } });
  } catch (err) {
    next(err);
  }
}

export async function addMemberHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { workspaceId } = req.params as { workspaceId: string };
    const { userId, role } = req.body as { userId?: string; role?: 'owner' | 'editor' | 'viewer' };
    if (!userId || !role) throw new AppError('userId and role are required', 400);

    const workspace = await service.addMember(workspaceId, userId, role);
    res.status(200).json({ success: true, data: { workspace } });
  } catch (err) {
    next(err);
  }
}

export async function updateMemberRoleHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { workspaceId, userId } = req.params as { workspaceId: string; userId: string };
    const { role } = req.body as { role?: 'owner' | 'editor' | 'viewer' };
    if (!role) throw new AppError('role is required', 400);

    const workspace = await service.updateMemberRole(workspaceId, userId, role);
    res.status(200).json({ success: true, data: { workspace } });
  } catch (err) {
    next(err);
  }
}

export async function removeMemberHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { workspaceId, userId } = req.params as { workspaceId: string; userId: string };
    const workspace = await service.removeMember(workspaceId, userId);
    res.status(200).json({ success: true, data: { workspace } });
  } catch (err) {
    next(err);
  }
}
