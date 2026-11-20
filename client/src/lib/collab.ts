import { useEffect, useReducer, useState } from 'react';
import type { Socket } from 'socket.io-client';
import * as Y from 'yjs';
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness';
import type { WorkspaceRole } from '@shared/types';
import { getSocket } from './socket';

type Status = 'connecting' | 'connected' | 'disconnected';
type JoinResponse =
  | { ok: true; role: WorkspaceRole; state: ArrayBuffer }
  | { ok: false; error: string };
type AwarenessChange = { added: number[]; updated: number[]; removed: number[] };

const toBytes = (data: unknown): Uint8Array =>
  data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer);

/**
 * A minimal Yjs provider over Socket.io (see apps/server/src/realtime/collab.ts).
 * BlockNote only needs `awareness`; the document sync is handled here.
 */
export class SocketProvider {
  readonly awareness: Awareness;
  status: Status = 'connecting';
  synced = false;
  role: WorkspaceRole | null = null;
  error: string | null = null;

  private dirty = false; // local edits made while offline
  private destroyed = false;
  private listeners = new Set<() => void>();

  constructor(
    private readonly socket: Socket,
    readonly pageId: string,
    readonly doc: Y.Doc,
  ) {
    this.awareness = new Awareness(doc);
    doc.on('update', this.onDocUpdate);
    this.awareness.on('update', this.onAwarenessUpdate);
    socket.on('connect', this.join);
    socket.on('disconnect', this.onDisconnect);
    socket.on('doc:update', this.onRemoteUpdate);
    socket.on('doc:sync', this.onSyncRequest);
    socket.on('awareness:update', this.onRemoteAwareness);
    socket.on('awareness:query', this.onAwarenessQuery);
    socket.on('awareness:remove', this.onAwarenessRemove);
    if (socket.connected) this.join();
  }

  get canEdit(): boolean {
    return this.role === 'owner' || this.role === 'editor';
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private changed() {
    this.listeners.forEach((fn) => fn());
  }

  private join = () => {
    this.socket
      .timeout(15_000)
      .emit('doc:join', this.pageId, this.doc.clientID, (err: Error | null, res?: JoinResponse) => {
        if (this.destroyed) return;
        if (err || !res) {
          // Timed out: try again while still connected.
          if (this.socket.connected) setTimeout(this.join, 2000);
          return;
        }
        if (!res.ok) {
          this.error = res.error;
          this.changed();
          return;
        }

        this.role = res.role;
        const serverState = toBytes(res.state);
        Y.applyUpdate(this.doc, serverState, this);
        if (this.dirty && this.canEdit) {
          // Send what the server is missing from our offline edits.
          const missing = Y.encodeStateAsUpdate(
            this.doc,
            Y.encodeStateVectorFromUpdate(serverState),
          );
          this.socket.emit('doc:update', this.pageId, missing);
        }
        this.dirty = false;
        // Ask peers for anything not persisted yet, and for their cursors.
        this.socket.emit('doc:sync', this.pageId, Y.encodeStateVector(this.doc));
        this.socket.emit('awareness:query', this.pageId);

        this.status = 'connected';
        this.synced = true;
        if (this.awareness.getLocalState()) this.sendAwareness([this.doc.clientID]);
        this.changed();
      });
  };

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this || this.role === 'viewer') return;
    if (this.status === 'connected') this.socket.emit('doc:update', this.pageId, update);
    else this.dirty = true;
  };

  private onRemoteUpdate = (pageId: string, update: ArrayBuffer) => {
    if (pageId === this.pageId) Y.applyUpdate(this.doc, toBytes(update), this);
  };

  private onSyncRequest = (pageId: string, stateVector: ArrayBuffer, fromSocketId: string) => {
    if (pageId !== this.pageId || !this.synced || !this.canEdit) return;
    const diff = Y.encodeStateAsUpdate(this.doc, toBytes(stateVector));
    if (diff.length > 2) this.socket.emit('doc:sync-reply', this.pageId, fromSocketId, diff);
  };

  private sendAwareness(clients: number[]) {
    if (this.status !== 'connected') return;
    this.socket.emit(
      'awareness:update',
      this.pageId,
      encodeAwarenessUpdate(this.awareness, clients),
    );
  }

  private onAwarenessUpdate = ({ added, updated, removed }: AwarenessChange, origin: unknown) => {
    if (origin === 'local') this.sendAwareness([...added, ...updated, ...removed]);
  };

  private onRemoteAwareness = (pageId: string, update: ArrayBuffer) => {
    if (pageId === this.pageId) applyAwarenessUpdate(this.awareness, toBytes(update), this);
  };

  private onAwarenessQuery = (pageId: string) => {
    if (pageId === this.pageId && this.awareness.getLocalState())
      this.sendAwareness([this.doc.clientID]);
  };

  private onAwarenessRemove = (pageId: string, clientIds: number[]) => {
    if (pageId === this.pageId) removeAwarenessStates(this.awareness, clientIds, this);
  };

  private onDisconnect = () => {
    this.status = 'disconnected';
    // Peers re-announce themselves when we reconnect.
    const others = [...this.awareness.getStates().keys()].filter((id) => id !== this.doc.clientID);
    removeAwarenessStates(this.awareness, others, this);
    this.changed();
  };

  destroy(): void {
    this.destroyed = true;
    removeAwarenessStates(this.awareness, [this.doc.clientID], 'local'); // tells peers we left
    this.socket.emit('doc:leave', this.pageId);
    this.socket.off('connect', this.join);
    this.socket.off('disconnect', this.onDisconnect);
    this.socket.off('doc:update', this.onRemoteUpdate);
    this.socket.off('doc:sync', this.onSyncRequest);
    this.socket.off('awareness:update', this.onRemoteAwareness);
    this.socket.off('awareness:query', this.onAwarenessQuery);
    this.socket.off('awareness:remove', this.onAwarenessRemove);
    this.doc.off('update', this.onDocUpdate);
    this.awareness.off('update', this.onAwarenessUpdate);
    this.awareness.destroy();
    this.listeners.clear();
  }
}

export interface Collab {
  doc: Y.Doc;
  provider: SocketProvider;
}

/** Creates the Yjs doc + provider for a page (null = none); re-renders on status changes. */
export function useCollab(pageId: string | null): Collab | null {
  const [collab, setCollab] = useState<Collab | null>(null);
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!pageId) return;
    const doc = new Y.Doc();
    const provider = new SocketProvider(getSocket(), pageId, doc);
    const unsubscribe = provider.subscribe(rerender);
    setCollab({ doc, provider });
    return () => {
      unsubscribe();
      provider.destroy();
      doc.destroy();
    };
  }, [pageId]);

  return collab?.provider.pageId === pageId ? collab : null;
}

export interface Peer {
  clientId: number;
  name: string;
  color: string;
}

/** Other people currently on the page (from awareness), one entry per person. */
export function usePeers(provider: SocketProvider | undefined): Peer[] {
  const [peers, setPeers] = useState<Peer[]>([]);

  useEffect(() => {
    if (!provider) return;
    const { awareness, doc } = provider;
    let live = true;
    // Awareness can change while the editor is rendering; defer the state update.
    const update = () => queueMicrotask(() => live && compute());
    const compute = () => {
      const seen = new Set<string>();
      const list: Peer[] = [];
      awareness.getStates().forEach((state, clientId) => {
        const user = (state as { user?: { name?: string; color?: string } }).user;
        if (clientId === doc.clientID || !user?.name) return;
        const key = `${user.name}|${user.color}`;
        if (seen.has(key)) return;
        seen.add(key);
        list.push({ clientId, name: user.name, color: user.color ?? '#71717a' });
      });
      setPeers(list);
    };
    update();
    awareness.on('change', update);
    return () => {
      live = false;
      awareness.off('change', update);
    };
  }, [provider]);

  return peers;
}
