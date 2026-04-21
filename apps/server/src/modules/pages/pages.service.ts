import { Types } from 'mongoose';
import { AppError } from '../../errors/AppError';
import { Page } from '../../models/Page.model';

export async function createPage(workspaceId: string, title: string, parent: string | null) {
  if (!Types.ObjectId.isValid(workspaceId)) throw new AppError('Invalid workspaceId', 400);
  if (parent && !Types.ObjectId.isValid(parent)) throw new AppError('Invalid parent page id', 400);

  return Page.create({
    title,
    workspace: new Types.ObjectId(workspaceId),
    parent: parent ? new Types.ObjectId(parent) : null,
    // slug is handled by your Page.model.ts pre-save
  });
}

export async function listPages(workspaceId: string) {
  if (!Types.ObjectId.isValid(workspaceId)) throw new AppError('Invalid workspaceId', 400);
  return Page.find({ workspace: workspaceId }).sort({ updatedAt: -1 });
}
