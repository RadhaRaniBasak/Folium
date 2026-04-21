import { Types } from 'mongoose';
import { AppError } from '../../errors/AppError';
import { Workspace, WorkspaceRole } from '../../models/Workspace.model';
import { User } from '../auth/models/User.model';

export async function createWorkspace(ownerId: string, name: string) {
  if (!Types.ObjectId.isValid(ownerId)) throw new AppError('Invalid ownerId', 400);

  const workspace = await Workspace.create({
    name,
    owner: new Types.ObjectId(ownerId),
    members: [{ user: new Types.ObjectId(ownerId), role: 'owner' }],
  });

  return workspace;
}

export async function listMyWorkspaces(userId: string) {
  return Workspace.find({
    $or: [{ owner: userId }, { 'members.user': userId }],
  }).sort({ updatedAt: -1 });
}

export async function getWorkspaceById(workspaceId: string) {
  if (!Types.ObjectId.isValid(workspaceId)) throw new AppError('Invalid workspaceId', 400);
  return Workspace.findById(workspaceId);
}

export async function addMember(workspaceId: string, userId: string, role: WorkspaceRole) {
  if (!Types.ObjectId.isValid(workspaceId)) throw new AppError('Invalid workspaceId', 400);
  if (!Types.ObjectId.isValid(userId)) throw new AppError('Invalid userId', 400);

  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404);

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new AppError('Workspace not found', 404);

  const already =
    String(workspace.owner) === userId || workspace.members.some((m) => String(m.user) === userId);
  if (already) throw new AppError('User is already a member', 409);

  workspace.members.push({ user: new Types.ObjectId(userId), role });
  await workspace.save();

  return workspace;
}

export async function updateMemberRole(workspaceId: string, userId: string, role: WorkspaceRole) {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new AppError('Workspace not found', 404);

  if (String(workspace.owner) === userId) {
    throw new AppError('Cannot change role of workspace owner', 400);
  }

  const member = workspace.members.find((m) => String(m.user) === userId);
  if (!member) throw new AppError('Member not found', 404);

  member.role = role;
  await workspace.save();
  return workspace;
}

export async function removeMember(workspaceId: string, userId: string) {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new AppError('Workspace not found', 404);

  if (String(workspace.owner) === userId) {
    throw new AppError('Cannot remove workspace owner', 400);
  }

  workspace.members = workspace.members.filter((m) => String(m.user) !== userId);
  await workspace.save();
  return workspace;
}
