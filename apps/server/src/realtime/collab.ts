import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import * as Y from 'yjs';
import { env } from '../config/env';
import { getRedisClient } from '../config/redis';
import { DocUpdate } from '../models/DocUpdate.model';
import { Page } from '../models/Page.model';
import { getRoleOrThrow } from '../modules/workspaces/access';

/**
 * Real-time collaboration.
 *
 * The server is a stateless relay: it checks access, forwards Yjs updates and
 * awareness (cursors/presence) to everyone in the page's room, and appends each
 * update to MongoDB. Rooms are shared across server instances through the Redis
 * adapter. Yjs updates are idempotent, so duplicate deliveries are harmless.
 */

let io: Server | null = null;

/** Rows are merged into one when a page's log grows past this. */
const COMPACT_AFTER = 100;

type Ack = (res: unknown) => void;
type JoinedDoc = { clientId: number; canEdit: boolean };

const docRoom = (pageId: string) => `doc:${pageId}`;
const wsRoom = (workspaceId: string) => `ws:${workspaceId}`;

/** Notifies every client in a workspace (e.g. so sidebars refresh). No-op before startup. */
export function emitToWorkspace(workspaceId: string, event: string, payload?: unknown): void {
  io?.to(wsRoom(workspaceId)).emit(event, payload);
}

/** Merged Yjs state of a page (empty update if it has none yet). */
export async function loadDocState(pageId: string): Promise<Uint8Array> {
  const rows = await DocUpdate.find({ page: pageId }).sort({ _id: 1 }).select('update');
  if (rows.length === 0) return Y.mergeUpdates([]);

  const merged = Y.mergeUpdates(rows.map((r) => new Uint8Array(r.update)));
  if (rows.length > COMPACT_AFTER) {
    // Concurrent compactions are safe: the result only ever contains the same updates.
    await DocUpdate.create({ page: pageId, update: Buffer.from(merged) });
    await DocUpdate.deleteMany({ _id: { $in: rows.map((r) => r._id) } });
  }
  return merged;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong';
}

export function attachCollab(server: HttpServer): Server {
  io = new Server(server, {
    cors: { origin: env.CLIENT_URL, credentials: true },
    maxHttpBufferSize: 5e6,
  });

  const pub = getRedisClient().duplicate();
  const sub = pub.duplicate();
  for (const client of [pub, sub])
    client.on('error', (err) => console.error('❌ Redis (socket) error:', err));
  io.adapter(createAdapter(pub, sub));

  io.use((socket, next) => {
    const token: unknown = socket.handshake.auth?.['token'];
    if (typeof token !== 'string') return next(new Error('unauthorized'));
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as { userId: string };
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    const joined = new Map<string, JoinedDoc>();

    socket.on('workspace:join', async (workspaceId: unknown, ack?: Ack) => {
      try {
        if (typeof workspaceId !== 'string') throw new Error('workspaceId is required');
        await getRoleOrThrow(userId, workspaceId);
        await socket.join(wsRoom(workspaceId));
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: errorMessage(err) });
      }
    });

    socket.on('workspace:leave', (workspaceId: unknown) => {
      if (typeof workspaceId === 'string') void socket.leave(wsRoom(workspaceId));
    });

    socket.on('doc:join', async (pageId: unknown, clientId: unknown, ack?: Ack) => {
      try {
        if (typeof pageId !== 'string' || !Types.ObjectId.isValid(pageId))
          throw new Error('Invalid pageId');
        if (typeof clientId !== 'number') throw new Error('clientId is required');

        const page = await Page.findById(pageId).select('workspace deletedAt');
        if (!page || page.deletedAt) throw new Error('Page not found');
        // ponytail: access is checked on join only; a role change applies on the next join.
        const role = await getRoleOrThrow(userId, String(page.workspace));

        joined.set(pageId, { clientId, canEdit: role !== 'viewer' });
        // Join before loading so updates sent meanwhile are not missed.
        await socket.join(docRoom(pageId));
        const state = await loadDocState(pageId);
        ack?.({ ok: true, role, state });
      } catch (err) {
        ack?.({ ok: false, error: errorMessage(err) });
      }
    });

    socket.on('doc:update', async (pageId: unknown, update: unknown) => {
      const entry = typeof pageId === 'string' ? joined.get(pageId) : undefined;
      if (!entry?.canEdit || !(update instanceof Uint8Array) || typeof pageId !== 'string') return;

      socket.to(docRoom(pageId)).emit('doc:update', pageId, update);
      try {
        await DocUpdate.create({ page: pageId, update: Buffer.from(update) });
      } catch (err) {
        console.error('Failed to persist doc update:', err);
      }
    });

    // A joining client asks peers for anything not yet persisted (Yjs sync step 1).
    socket.on('doc:sync', (pageId: unknown, stateVector: unknown) => {
      if (typeof pageId !== 'string' || !joined.has(pageId) || !(stateVector instanceof Uint8Array))
        return;
      socket.to(docRoom(pageId)).emit('doc:sync', pageId, stateVector, socket.id);
    });

    // …and peers that can edit answer only that client (sync step 2).
    socket.on('doc:sync-reply', (pageId: unknown, toSocketId: unknown, update: unknown) => {
      if (typeof pageId !== 'string' || !joined.get(pageId)?.canEdit) return;
      if (typeof toSocketId !== 'string' || !(update instanceof Uint8Array)) return;
      io?.to(toSocketId).emit('doc:update', pageId, update);
    });

    socket.on('awareness:update', (pageId: unknown, update: unknown) => {
      if (typeof pageId !== 'string' || !joined.has(pageId) || !(update instanceof Uint8Array))
        return;
      socket.to(docRoom(pageId)).emit('awareness:update', pageId, update);
    });

    socket.on('awareness:query', (pageId: unknown) => {
      if (typeof pageId !== 'string' || !joined.has(pageId)) return;
      socket.to(docRoom(pageId)).emit('awareness:query', pageId);
    });

    const leaveDoc = (pageId: string) => {
      const entry = joined.get(pageId);
      if (!entry) return;
      joined.delete(pageId);
      socket.to(docRoom(pageId)).emit('awareness:remove', pageId, [entry.clientId]);
      void socket.leave(docRoom(pageId));
    };

    socket.on('doc:leave', (pageId: unknown) => {
      if (typeof pageId === 'string') leaveDoc(pageId);
    });

    socket.on('disconnecting', () => {
      for (const pageId of [...joined.keys()]) leaveDoc(pageId);
    });
  });

  return io;
}
