import { Types } from 'mongoose';
import * as Y from 'yjs';
import { getRedisClient } from '../../config/redis';
import { AppError } from '../../errors/AppError';
import { Page } from '../../models/Page.model';
import { PageVersion, type IPageVersion } from '../../models/PageVersion.model';
import { loadDocState } from '../../realtime/collab';
import { assertCanEdit, getRoleOrThrow } from '../workspaces/access';

/** At most one automatic version per page every 10 minutes of editing (VERSION_INTERVAL, seconds). */
const interval = () => Number(process.env['VERSION_INTERVAL'] ?? 600);
/** Automatic versions kept per page; named ones are kept forever. */
const KEEP_AUTO = 100;
const PAGE_SIZE = 30;
const MAX_BYTES = 1.5 * 1024 * 1024;

/**
 * Called with each edit before it's stored. The first edit of a session (or the first after 10
 * minutes) saves the page as it stood, credited to whoever edited since the last version.
 */
export async function snapshotIfDue(pageId: string, userId: string): Promise<void> {
  const redis = getRedisClient();
  const authorsKey = `ver:by:${pageId}`;
  if ((await redis.set(`ver:due:${pageId}`, '1', 'EX', interval(), 'NX')) === 'OK') {
    const by = await redis.smembers(authorsKey);
    await redis.del(authorsKey);
    const state = await loadDocState(pageId);
    if (state.length > 2 && by.length > 0) {
      await PageVersion.create({ page: pageId, state: Buffer.from(state), by, auto: true });
      const old = await PageVersion.find({ page: pageId, auto: true, name: null })
        .sort({ _id: -1 })
        .skip(KEEP_AUTO)
        .select('_id');
      if (old.length > 0) await PageVersion.deleteMany({ _id: { $in: old.map((v) => v._id) } });
    }
  }
  await redis.sadd(authorsKey, userId);
  await redis.expire(authorsKey, 7 * 24 * 60 * 60);
}

async function loadPage(userId: string, pageId: string, edit = false) {
  if (!Types.ObjectId.isValid(pageId)) throw new AppError('Page not found', 404);
  const page = await Page.findById(pageId).select('workspace');
  if (!page) throw new AppError('Page not found', 404);
  const role = await getRoleOrThrow(userId, String(page.workspace));
  if (edit) assertCanEdit(role);
  return page;
}

async function loadVersion(pageId: string, versionId: string): Promise<IPageVersion> {
  const version = Types.ObjectId.isValid(versionId)
    ? await PageVersion.findOne({ _id: versionId, page: pageId })
    : null;
  if (!version) throw new AppError('Version not found', 404);
  return version;
}

const toSnapshot = (v: IPageVersion) => ({
  id: String(v._id),
  createdAt: v.createdAt.getTime(),
  name: v.name ?? undefined,
  by: v.by.map(String),
});

export async function listVersions(userId: string, pageId: string, cursor?: string) {
  await loadPage(userId, pageId);
  const before = cursor && Types.ObjectId.isValid(cursor) ? { _id: { $lt: cursor } } : {};
  const rows = await PageVersion.find({ page: pageId, ...before })
    .sort({ _id: -1 })
    .limit(PAGE_SIZE + 1)
    .select('-state');
  const snapshots = rows.slice(0, PAGE_SIZE).map(toSnapshot);
  return { snapshots, nextCursor: rows.length > PAGE_SIZE ? snapshots.at(-1)!.id : undefined };
}

export async function getVersion(userId: string, pageId: string, versionId: string) {
  await loadPage(userId, pageId);
  const version = await loadVersion(pageId, versionId);
  return { state: version.state.toString('base64') };
}

export async function createVersion(
  userId: string,
  pageId: string,
  body: { state?: unknown; name?: unknown },
) {
  await loadPage(userId, pageId, true);
  if (typeof body.state !== 'string' || body.state.length > (MAX_BYTES * 4) / 3) {
    throw new AppError('state must be a base64 Yjs update (up to 1.5 MB)', 400);
  }
  const state = Buffer.from(body.state, 'base64');
  try {
    Y.applyUpdate(new Y.Doc(), new Uint8Array(state));
  } catch {
    throw new AppError('state is not a Yjs update', 400);
  }
  const name =
    typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 100) : null;
  const version = await PageVersion.create({
    page: pageId,
    state,
    name,
    by: [userId],
    auto: false,
  });
  return toSnapshot(version);
}

export async function renameVersion(
  userId: string,
  pageId: string,
  versionId: string,
  name: unknown,
) {
  await loadPage(userId, pageId, true);
  const version = await loadVersion(pageId, versionId);
  version.name = typeof name === 'string' && name.trim() ? name.trim().slice(0, 100) : null;
  await version.save();
  return toSnapshot(version);
}

export async function deleteVersion(userId: string, pageId: string, versionId: string) {
  await loadPage(userId, pageId, true);
  await (await loadVersion(pageId, versionId)).deleteOne();
  return { ok: true };
}
