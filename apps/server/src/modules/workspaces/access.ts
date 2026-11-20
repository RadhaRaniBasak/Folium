import { Types } from 'mongoose';
import { AppError } from '../../errors/AppError';
import { Workspace, WorkspaceRole } from '../../models/Workspace.model';

/** Resolves the caller's role in a workspace, or throws 403/404. */
export async function getRoleOrThrow(userId: string, workspaceId: string): Promise<WorkspaceRole> {
  if (!Types.ObjectId.isValid(workspaceId)) throw new AppError('Invalid workspaceId', 400);

  const ws = await Workspace.findById(workspaceId).select('owner members');
  if (!ws) throw new AppError('Workspace not found', 404);
  if (String(ws.owner) === userId) return 'owner';

  const member = ws.members.find((m) => String(m.user) === userId);
  if (!member) throw new AppError('Forbidden — not a workspace member', 403);
  return member.role;
}

export function assertCanEdit(role: WorkspaceRole): void {
  if (role === 'viewer') throw new AppError('Forbidden — read-only role', 403);
}
