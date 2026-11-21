import * as Y from 'yjs';
import type { VersionError, VersionResult, VersionStorage } from '@blocknote/core/extensions';
import { yXmlFragmentToBlocks } from '@blocknote/core/yjs';
import { prosemirrorToYXmlFragment, yXmlFragmentToProseMirrorRootNode } from 'y-prosemirror';
import type { FoliumEditor } from '../components/editorSchema';
import { HttpError, OfflineError, Pages, Versions } from './api';
import { FRAGMENT } from './collab';

/** BlockNote's version history, stored on our server. Content is the page's Yjs state. */

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

function failure(err: unknown): VersionError {
  if (err instanceof OfflineError) return { type: 'network' };
  const status = err instanceof HttpError ? err.status : 500;
  if (status === 403) return { type: 'forbidden' };
  if (status === 404) return { type: 'not-found' };
  return { type: 'server', status };
}

async function attempt<T>(run: () => Promise<T>): Promise<VersionResult<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (err) {
    return { ok: false, error: failure(err) };
  }
}

export function versionStorage(
  pageId: string,
  canEdit: boolean,
  live: () => { editor: FoliumEditor; doc: Y.Doc },
): VersionStorage<Uint8Array> {
  const read: VersionStorage<Uint8Array> = {
    list: (_signal, cursor) => attempt(() => Versions.list(pageId, cursor)),
    getContent: (id) => attempt(async () => fromBase64(await Versions.get(pageId, id))),
  };
  if (!canEdit) return read;

  return {
    ...read,
    create: (content, name) => attempt(() => Versions.create(pageId, toBase64(content), name)),
    rename: (id, name) =>
      attempt(async () => {
        await Versions.rename(pageId, id, name);
      }),
    remove: (id) =>
      attempt(async () => {
        await Versions.remove(pageId, id);
      }),
    // Writes the old content into the live document, so everyone sees the restore as an edit.
    // It goes through ProseMirror rather than blocks to keep comment highlights.
    restore: (id) =>
      attempt(async () => {
        const { editor, doc } = live();
        const old = new Y.Doc();
        Y.applyUpdate(old, fromBase64(await Versions.get(pageId, id)));
        // Keep what's about to be replaced: a restore can be undone the same way.
        await Versions.create(pageId, toBase64(Y.encodeStateAsUpdate(doc)), 'Before restore');
        const content = yXmlFragmentToProseMirrorRootNode(
          old.getXmlFragment(FRAGMENT),
          editor.pmSchema,
        );
        doc.transact(() => {
          const fragment = doc.getXmlFragment(FRAGMENT);
          fragment.delete(0, fragment.length);
          prosemirrorToYXmlFragment(content, fragment);
        });
        void Pages.saveBlocks(
          pageId,
          yXmlFragmentToBlocks(editor, old.getXmlFragment(FRAGMENT)),
        ).catch(() => {});
        old.destroy();
      }),
  };
}
