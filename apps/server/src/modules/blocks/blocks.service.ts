import { Types } from 'mongoose';
import { AppError } from '../../errors/AppError';
import { Block } from '../../models/Block.model';
import { Page } from '../../models/Page.model';
import { Workspace } from '../../models/Workspace.model';

async function getWorkspaceRoleOrThrow(userId: string, workspaceId: string) {
  const ws = await Workspace.findById(workspaceId);
  if (!ws) throw new AppError('Workspace not found', 404);

  if (String(ws.owner) === userId) return 'owner' as const;

  const member = ws.members.find((m) => String(m.user) === userId);
  if (!member) throw new AppError('Forbidden — not a workspace member', 403);

  return member.role;
}

export async function createBlock(input: {
  userId: string;
  pageId: string;
  type: string;
  props: Record<string, unknown>;
  parentBlock: string | null;
  order: number;
}) {
  const { userId, pageId, type, props, parentBlock, order } = input;

  if (!Types.ObjectId.isValid(pageId)) throw new AppError('Invalid pageId', 400);
  if (parentBlock && !Types.ObjectId.isValid(parentBlock)) throw new AppError('Invalid parentBlock', 400);

  const page = await Page.findById(pageId);
  if (!page) throw new AppError('Page not found', 404);

  const role = await getWorkspaceRoleOrThrow(userId, String(page.workspace));
  if (role === 'viewer') throw new AppError('Forbidden — read-only role', 403);

  return Block.create({
    workspace: page.workspace,
    page: page._id,
    parentBlock: parentBlock ? new Types.ObjectId(parentBlock) : null,
    type,
    props,
    order,
  });
}

export async function listBlocks(input: { userId: string; pageId: string; parentBlock: string | null }) {
  const { userId, pageId, parentBlock } = input;

  if (!Types.ObjectId.isValid(pageId)) throw new AppError('Invalid pageId', 400);
  if (parentBlock && !Types.ObjectId.isValid(parentBlock)) throw new AppError('Invalid parentBlock', 400);

  const page = await Page.findById(pageId);
  if (!page) throw new AppError('Page not found', 404);

  await getWorkspaceRoleOrThrow(userId, String(page.workspace)); // viewer allowed

  return Block.find({
    page: pageId,
    parentBlock: parentBlock ? parentBlock : null,
  }).sort({ order: 1, createdAt: 1 });
}
