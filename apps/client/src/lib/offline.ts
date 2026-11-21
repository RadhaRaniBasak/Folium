import type { UpdatePageInput } from '@shared/types';
import { OfflineError } from './api';

/** Small JSON cache in localStorage (page lists, workspaces, roles) so the app opens offline. */
export const cache = {
  read<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  write(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or disabled: the cache is only a convenience.
    }
  },
};

const OUTBOX = 'folium:outbox';
type Outbox = Record<string, UpdatePageInput>;

/** Remembers a page edit (title, icon, …) made offline; later edits to the same page merge. */
export function queuePatch(pageId: string, patch: UpdatePageInput): void {
  const box = cache.read<Outbox>(OUTBOX) ?? {};
  const queued = box[pageId];
  // Row values are partial updates: merge them too, or a second cell edit drops the first.
  box[pageId] = {
    ...queued,
    ...patch,
    ...(patch.props && { props: { ...queued?.props, ...patch.props } }),
  };
  cache.write(OUTBOX, box);
}

/** Replays queued edits; stops at the first network failure and keeps the rest. */
export async function flushOutbox(
  send: (pageId: string, patch: UpdatePageInput) => Promise<unknown>,
) {
  const box = cache.read<Outbox>(OUTBOX);
  if (!box) return;
  for (const [pageId, patch] of Object.entries(box)) {
    try {
      await send(pageId, patch);
    } catch (err) {
      if (err instanceof OfflineError) break;
      // Rejected by the server (deleted page, lost access): drop it.
    }
    delete box[pageId];
  }
  cache.write(OUTBOX, box);
}

/** Wipes cached pages and offline documents (on logout — the device may be shared). */
export async function clearOfflineData(): Promise<void> {
  Object.keys(localStorage)
    .filter((key) => /^folium:(pages|role|members):/.test(key))
    .concat(OUTBOX, 'folium:workspaces', 'folium:user')
    .forEach((key) => localStorage.removeItem(key));

  const dbs = (await indexedDB.databases?.()) ?? [];
  await Promise.all(
    dbs
      .filter((db) => db.name?.startsWith('folium:'))
      .map(
        (db) =>
          new Promise((resolve) => {
            const req = indexedDB.deleteDatabase(db.name!);
            req.onsuccess = req.onerror = req.onblocked = () => resolve(null);
          }),
      ),
  );
}
