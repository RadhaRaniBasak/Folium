import { Types } from 'mongoose';
import type { PageSummary, SearchResult, UpdatePageInput, WorkspaceRole } from '@repo/shared';
import { AppError } from '../../errors/AppError';
import { Block } from '../../models/Block.model';
import { DocUpdate } from '../../models/DocUpdate.model';
import { IPage, Page, PAGE_FONTS, PageFont } from '../../models/Page.model';
import { emitToWorkspace, loadDocState } from '../../realtime/collab';
import { assertCanEdit, getRoleOrThrow } from '../workspaces/access';

const SUMMARY_FIELDS =
  'workspace parent title icon coverImage order fullWidth font isFavorited deletedAt createdAt updatedAt';

function toObjectId(id: string, name: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) throw new AppError(`Invalid ${name}`, 400);
  return new Types.ObjectId(id);
}

function toSummary(page: IPage, userId: string): PageSummary {
  return {
    _id: String(page._id),
    workspace: String(page.workspace),
    parent: page.parent ? String(page.parent) : null,
    title: page.title ?? '',
    icon: page.icon ?? null,
    coverImage: page.coverImage ?? null,
    order: page.order ?? 0,
    fullWidth: Boolean(page.fullWidth),
    font: page.font ?? 'sans',
    isFavorite: page.isFavorited?.get(userId) === true,
    deletedAt: page.deletedAt ? page.deletedAt.toISOString() : null,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  };
}

function cleanTitle(title: unknown): string {
  return typeof title === 'string' ? title.slice(0, 300) : '';
}

function cleanIcon(icon: unknown): string | undefined {
  if (icon === undefined || icon === null || icon === '') return undefined;
  if (typeof icon !== 'string' || icon.length > 32) throw new AppError('Invalid icon', 400);
  return icon;
}

function cleanCover(cover: unknown): string | undefined {
  if (cover === null || cover === '') return undefined;
  if (typeof cover === 'string' && cover.length <= 2048) {
    if (/^gradient:[a-z-]+$/.test(cover) || /^https?:\/\/\S+$/.test(cover)) return cover;
  }
  throw new AppError('Cover must be an http(s) URL or a gradient preset', 400);
}

async function loadPage(userId: string, pageId: string, edit = false) {
  const page = await Page.findById(toObjectId(pageId, 'pageId'));
  if (!page) throw new AppError('Page not found', 404);
  const role = await getRoleOrThrow(userId, String(page.workspace));
  if (edit) assertCanEdit(role);
  return { page, role };
}

/** The page and all of its descendants. */
async function subtreeIds(
  workspace: Types.ObjectId,
  rootId: Types.ObjectId,
): Promise<Types.ObjectId[]> {
  const seen = new Set([String(rootId)]);
  const ids = [rootId];
  let frontier = [rootId];
  while (frontier.length > 0) {
    const children = await Page.find({ workspace, parent: { $in: frontier } }).select('_id');
    frontier = children.map((c) => c._id as Types.ObjectId).filter((id) => !seen.has(String(id)));
    frontier.forEach((id) => seen.add(String(id)));
    ids.push(...frontier);
  }
  return ids;
}

async function nextOrder(
  workspace: Types.ObjectId,
  parent: Types.ObjectId | null,
): Promise<number> {
  const last = await Page.findOne({ workspace, parent, deletedAt: null })
    .sort({ order: -1 })
    .select('order');
  return (last?.order ?? 0) + 1;
}

function notify(page: IPage) {
  emitToWorkspace(String(page.workspace), 'pages:changed', { pageId: String(page._id) });
}

export async function createPage(
  userId: string,
  workspaceId: string,
  input: { title?: unknown; parent?: unknown; icon?: unknown },
): Promise<PageSummary> {
  const workspace = toObjectId(workspaceId, 'workspaceId');

  let parent: Types.ObjectId | null = null;
  if (typeof input.parent === 'string' && input.parent) {
    parent = toObjectId(input.parent, 'parent page id');
    const exists = await Page.exists({ _id: parent, workspace, deletedAt: null });
    if (!exists) throw new AppError('Parent page not found', 404);
  }

  const page = await Page.create({
    title: cleanTitle(input.title),
    icon: cleanIcon(input.icon),
    workspace,
    parent,
    order: await nextOrder(workspace, parent),
    createdBy: new Types.ObjectId(userId),
    lastEditedBy: new Types.ObjectId(userId),
  });
  notify(page);
  return toSummary(page, userId);
}

export async function listPages(
  userId: string,
  workspaceId: string,
  trash = false,
): Promise<PageSummary[]> {
  const pages = await Page.find({
    workspace: toObjectId(workspaceId, 'workspaceId'),
    deletedAt: trash ? { $ne: null } : null,
  })
    .select(SUMMARY_FIELDS)
    .sort({ order: 1, createdAt: 1 });
  return pages.map((p) => toSummary(p, userId));
}

export async function getPage(
  userId: string,
  pageId: string,
): Promise<{ page: PageSummary; role: WorkspaceRole }> {
  const { page, role } = await loadPage(userId, pageId);
  return { page: toSummary(page, userId), role };
}

async function moveUnder(page: IPage, parentId: string | null) {
  if (parentId === null) {
    page.parent = null;
    return;
  }
  const target = toObjectId(parentId, 'parent page id');
  // Walk up from the new parent: meeting this page means the move would create a cycle.
  let cursor: Types.ObjectId | null = target;
  const seen = new Set<string>();
  while (cursor && !seen.has(String(cursor))) {
    if (String(cursor) === String(page._id)) {
      throw new AppError('A page cannot be moved inside itself', 400);
    }
    seen.add(String(cursor));
    const ancestor: IPage | null = await Page.findOne({
      _id: cursor,
      workspace: page.workspace,
      deletedAt: null,
    }).select('parent');
    if (!ancestor) throw new AppError('Parent page not found', 404);
    cursor = ancestor.parent;
  }
  page.parent = target;
}

export async function updatePage(
  userId: string,
  pageId: string,
  patch: UpdatePageInput,
): Promise<PageSummary> {
  const { page } = await loadPage(userId, pageId, true);
  if (page.deletedAt) throw new AppError('Restore the page before editing it', 400);

  if (patch.title !== undefined) page.title = cleanTitle(patch.title);
  if (patch.icon !== undefined) page.icon = cleanIcon(patch.icon);
  if (patch.coverImage !== undefined) page.coverImage = cleanCover(patch.coverImage);
  if (patch.fullWidth !== undefined) page.fullWidth = Boolean(patch.fullWidth);
  if (patch.font !== undefined) {
    if (!PAGE_FONTS.includes(patch.font as PageFont)) throw new AppError('Invalid font', 400);
    page.font = patch.font;
  }
  if (patch.parent !== undefined) await moveUnder(page, patch.parent);
  if (patch.order !== undefined) {
    if (typeof patch.order !== 'number' || !Number.isFinite(patch.order)) {
      throw new AppError('order must be a number', 400);
    }
    page.order = patch.order;
  }

  page.lastEditedBy = new Types.ObjectId(userId);
  await page.save();
  notify(page);
  return toSummary(page, userId);
}

export async function toggleFavorite(userId: string, pageId: string): Promise<PageSummary> {
  const { page } = await loadPage(userId, pageId); // viewers can favorite too
  if (page.isFavorited.get(userId)) page.isFavorited.delete(userId);
  else page.isFavorited.set(userId, true);
  await page.save({ timestamps: false });
  return toSummary(page, userId);
}

export async function trashPage(userId: string, pageId: string): Promise<{ count: number }> {
  const { page } = await loadPage(userId, pageId, true);
  const ids = await subtreeIds(page.workspace, page._id as Types.ObjectId);
  const res = await Page.updateMany(
    { _id: { $in: ids }, deletedAt: null },
    { $set: { deletedAt: new Date() } },
  );
  notify(page);
  return { count: res.modifiedCount };
}

export async function restorePage(userId: string, pageId: string): Promise<PageSummary> {
  const { page } = await loadPage(userId, pageId, true);
  const ids = await subtreeIds(page.workspace, page._id as Types.ObjectId);
  await Page.updateMany({ _id: { $in: ids } }, { $set: { deletedAt: null } });

  // If the old parent is gone or still in the trash, restore to the top level.
  if (page.parent && !(await Page.exists({ _id: page.parent, deletedAt: null }))) {
    page.parent = null;
    page.order = await nextOrder(page.workspace, null);
  }
  page.deletedAt = null;
  await page.save();
  notify(page);
  return toSummary(page, userId);
}

export async function deletePagePermanently(
  userId: string,
  pageId: string,
): Promise<{ count: number }> {
  const { page } = await loadPage(userId, pageId, true);
  if (!page.deletedAt) throw new AppError('Move the page to the trash first', 400);

  const ids = await subtreeIds(page.workspace, page._id as Types.ObjectId);
  await Promise.all([
    Block.deleteMany({ page: { $in: ids } }),
    DocUpdate.deleteMany({ page: { $in: ids } }),
  ]);
  const res = await Page.deleteMany({ _id: { $in: ids } });
  notify(page);
  return { count: res.deletedCount };
}

export async function duplicatePage(userId: string, pageId: string): Promise<PageSummary> {
  const { page } = await loadPage(userId, pageId, true);
  if (page.deletedAt) throw new AppError('Restore the page before duplicating it', 400);

  // Slot the copy right after the original.
  const next = await Page.findOne({
    workspace: page.workspace,
    parent: page.parent,
    deletedAt: null,
    order: { $gt: page.order },
  })
    .sort({ order: 1 })
    .select('order');

  const copy = await Page.create({
    title: `${page.title || 'Untitled'} (copy)`,
    text: page.text,
    workspace: page.workspace,
    parent: page.parent,
    order: next ? (page.order + next.order) / 2 : page.order + 1,
    icon: page.icon,
    coverImage: page.coverImage,
    fullWidth: page.fullWidth,
    font: page.font,
    createdBy: new Types.ObjectId(userId),
    lastEditedBy: new Types.ObjectId(userId),
  });

  // Copy the block snapshot, remapping parent links to the new block ids.
  const blocks = await Block.find({ page: page._id });
  const newIds = new Map(blocks.map((b) => [String(b._id), new Types.ObjectId()]));
  if (blocks.length > 0) {
    await Block.insertMany(
      blocks.map((b) => ({
        _id: newIds.get(String(b._id)),
        workspace: b.workspace,
        page: copy._id,
        parentBlock: b.parentBlock ? (newIds.get(String(b.parentBlock)) ?? null) : null,
        type: b.type,
        props: b.props,
        order: b.order,
      })),
    );
  }

  const state = await loadDocState(String(page._id));
  if (state.length > 2) await DocUpdate.create({ page: copy._id, update: Buffer.from(state) });

  notify(copy);
  return toSummary(copy, userId);
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function snippet(text: string, query: string): string | null {
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at === -1) return null;
  const start = Math.max(0, at - 40);
  const end = Math.min(text.length, at + query.length + 60);
  const body = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return `${start > 0 ? '…' : ''}${body}${end < text.length ? '…' : ''}`;
}

export async function searchPages(workspaceId: string, q: string): Promise<SearchResult[]> {
  const query = q.trim().slice(0, 100);
  if (!query) return [];

  // ponytail: regex scan is fine for personal workspaces; switch to a text/Atlas Search index at scale.
  const rx = new RegExp(escapeRegex(query), 'i');
  const pages = await Page.find({
    workspace: toObjectId(workspaceId, 'workspaceId'),
    deletedAt: null,
    $or: [{ title: rx }, { text: rx }],
  })
    .select('title icon parent text')
    .limit(20);

  return pages.map((p) => ({
    _id: String(p._id),
    title: p.title ?? '',
    icon: p.icon ?? null,
    parent: p.parent ? String(p.parent) : null,
    snippet: snippet(p.text ?? '', query),
  }));
}
