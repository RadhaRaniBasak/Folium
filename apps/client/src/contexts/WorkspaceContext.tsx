import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { PageSummary, UpdatePageInput, Workspace, WorkspaceRole } from '@shared/types';
import { useToast } from '../components/Toaster';
import { Pages, Workspaces } from '../lib/api';
import { getSocket } from '../lib/socket';
import { play } from '../lib/sound';
import { useAuth } from './AuthContext';

const LAST_WORKSPACE = 'folium:workspace';

interface CreatePageOptions {
  title?: string;
  icon?: string;
  /** Content to seed once the editor opens (first-run welcome page). */
  seed?: 'welcome';
  open?: boolean;
}

interface WorkspaceValue {
  workspaces: Workspace[];
  workspace: Workspace | null;
  role: WorkspaceRole;
  canEdit: boolean;
  pages: PageSummary[];
  pagesById: Map<string, PageSummary>;
  childrenOf: (parentId: string | null) => PageSummary[];
  ancestorsOf: (pageId: string) => PageSummary[];
  loading: boolean;
  /** `stay` keeps the current route (used when opening a page from another workspace). */
  switchWorkspace: (id: string, stay?: boolean) => void;
  createWorkspace: (name: string) => Promise<void>;
  createPage: (parent?: string | null, options?: CreatePageOptions) => Promise<PageSummary | null>;
  updatePage: (id: string, patch: UpdatePageInput) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  duplicatePage: (id: string) => Promise<void>;
  trashPage: (id: string) => Promise<void>;
  restorePage: (id: string) => Promise<void>;
  refresh: () => void;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

const byOrder = (a: PageSummary, b: PageSummary) =>
  a.order - b.order || a.createdAt.localeCompare(b.createdAt);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const bootstrapped = useRef(false);

  const workspace = workspaces.find((w) => w._id === workspaceId) ?? null;
  const role: WorkspaceRole =
    !workspace || !user
      ? 'viewer'
      : workspace.owner === user.id
        ? 'owner'
        : (workspace.members.find((m) => m.user === user.id)?.role ?? 'viewer');
  const canEdit = role !== 'viewer';

  const fail = useCallback(
    (err: unknown) => {
      toast(err instanceof Error ? err.message : 'Something went wrong', { tone: 'error' });
    },
    [toast],
  );

  // Load workspaces once; first-time users get a workspace and a welcome page.
  useEffect(() => {
    if (bootstrapped.current || !user) return;
    bootstrapped.current = true;
    (async () => {
      let list = await Workspaces.list();
      if (list.length === 0) {
        const created = await Workspaces.create(`${user.name.split(' ')[0]}'s Workspace`);
        list = [created];
        const welcome = await Pages.create(created._id, { title: 'Getting started', icon: '👋' });
        navigate(`/p/${welcome._id}`, { state: { seed: 'welcome' } });
      }
      setWorkspaces(list);
      const last = localStorage.getItem(LAST_WORKSPACE);
      setWorkspaceId(list.some((w) => w._id === last) ? last : (list[0]?._id ?? null));
    })().catch(fail);
  }, [user, navigate, fail]);

  const loadPages = useCallback(async (id: string) => {
    const list = await Pages.list(id);
    setPages(list);
    setLoading(false);
  }, []);

  // Pages for the current workspace + live refresh when anyone changes them.
  useEffect(() => {
    if (!workspaceId) return;
    localStorage.setItem(LAST_WORKSPACE, workspaceId);
    setLoading(true);
    loadPages(workspaceId).catch(fail);

    const socket = getSocket();
    const join = () => socket.emit('workspace:join', workspaceId);
    let timer: number | undefined;
    const onChanged = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void loadPages(workspaceId).catch(() => {}), 150);
    };
    join();
    socket.on('connect', join);
    socket.on('connect', onChanged);
    socket.on('pages:changed', onChanged);
    return () => {
      window.clearTimeout(timer);
      socket.emit('workspace:leave', workspaceId);
      socket.off('connect', join);
      socket.off('connect', onChanged);
      socket.off('pages:changed', onChanged);
    };
  }, [workspaceId, loadPages, fail]);

  const pagesById = useMemo(() => new Map(pages.map((p) => [p._id, p])), [pages]);

  const childrenMap = useMemo(() => {
    const map = new Map<string | null, PageSummary[]>();
    for (const page of pages) {
      const key = page.parent && pagesById.has(page.parent) ? page.parent : null;
      map.set(key, [...(map.get(key) ?? []), page]);
    }
    map.forEach((list) => list.sort(byOrder));
    return map;
  }, [pages, pagesById]);

  const childrenOf = useCallback(
    (parentId: string | null) => childrenMap.get(parentId) ?? [],
    [childrenMap],
  );

  const ancestorsOf = useCallback(
    (pageId: string) => {
      const chain: PageSummary[] = [];
      let cursor = pagesById.get(pageId)?.parent ?? null;
      while (cursor && chain.length < 50) {
        const parent = pagesById.get(cursor);
        if (!parent) break;
        chain.unshift(parent);
        cursor = parent.parent;
      }
      return chain;
    },
    [pagesById],
  );

  const refresh = useCallback(() => {
    if (workspaceId) loadPages(workspaceId).catch(fail);
  }, [workspaceId, loadPages, fail]);

  const switchWorkspace = useCallback(
    (id: string, stay = false) => {
      if (id === workspaceId) return;
      setPages([]);
      setWorkspaceId(id);
      if (!stay) navigate('/');
      // Opened a page from a workspace we were just invited to: refresh the list.
      if (!workspaces.some((w) => w._id === id)) Workspaces.list().then(setWorkspaces).catch(fail);
    },
    [workspaceId, workspaces, navigate, fail],
  );

  const createWorkspace = useCallback(
    async (name: string) => {
      try {
        const created = await Workspaces.create(name);
        setWorkspaces((list) => [created, ...list]);
        switchWorkspace(created._id);
        play('tick');
      } catch (err) {
        fail(err);
      }
    },
    [switchWorkspace, fail],
  );

  const createPage = useCallback(
    async (parent: string | null = null, options: CreatePageOptions = {}) => {
      if (!workspaceId) return null;
      try {
        const page = await Pages.create(workspaceId, {
          parent,
          title: options.title,
          icon: options.icon,
        });
        setPages((list) => [...list.filter((p) => p._id !== page._id), page]);
        play('tick');
        if (options.open !== false) {
          navigate(`/p/${page._id}`, { state: options.seed ? { seed: options.seed } : undefined });
        }
        return page;
      } catch (err) {
        fail(err);
        return null;
      }
    },
    [workspaceId, navigate, fail],
  );

  const updatePage = useCallback(
    async (id: string, patch: UpdatePageInput) => {
      setPages((list) => list.map((p) => (p._id === id ? { ...p, ...patch } : p)));
      try {
        const saved = await Pages.update(id, patch);
        setPages((list) =>
          list.map((p) => (p._id === id ? { ...saved, isFavorite: p.isFavorite } : p)),
        );
      } catch (err) {
        fail(err);
        refresh();
      }
    },
    [fail, refresh],
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      setPages((list) => list.map((p) => (p._id === id ? { ...p, isFavorite: !p.isFavorite } : p)));
      play('pop');
      try {
        await Pages.favorite(id);
      } catch (err) {
        fail(err);
        refresh();
      }
    },
    [fail, refresh],
  );

  const restorePage = useCallback(
    async (id: string) => {
      try {
        await Pages.restore(id);
        refresh();
        toast('Page restored');
      } catch (err) {
        fail(err);
      }
    },
    [refresh, toast, fail],
  );

  const trashPage = useCallback(
    async (id: string) => {
      // Hide the page and its subpages right away.
      const doomed = new Set([id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const p of pages) {
          if (p.parent && doomed.has(p.parent) && !doomed.has(p._id)) {
            doomed.add(p._id);
            grew = true;
          }
        }
      }
      setPages((list) => list.filter((p) => !doomed.has(p._id)));
      const openId = location.pathname.startsWith('/p/') ? location.pathname.slice(3) : null;
      if (openId && doomed.has(openId)) {
        const parent = pagesById.get(id)?.parent;
        navigate(parent && !doomed.has(parent) ? `/p/${parent}` : '/');
      }
      play('thunk');
      try {
        await Pages.trash(id);
        toast('Moved to trash', { action: { label: 'Undo', onClick: () => void restorePage(id) } });
      } catch (err) {
        fail(err);
        refresh();
      }
    },
    [pages, pagesById, location.pathname, navigate, toast, restorePage, fail, refresh],
  );

  const duplicatePage = useCallback(
    async (id: string) => {
      try {
        const copy = await Pages.duplicate(id);
        setPages((list) => [...list, copy]);
        play('tick');
        navigate(`/p/${copy._id}`);
        toast('Page duplicated');
      } catch (err) {
        fail(err);
      }
    },
    [navigate, toast, fail],
  );

  const value: WorkspaceValue = {
    workspaces,
    workspace,
    role,
    canEdit,
    pages,
    pagesById,
    childrenOf,
    ancestorsOf,
    loading: loading || !workspace,
    switchWorkspace,
    createWorkspace,
    createPage,
    updatePage,
    toggleFavorite,
    duplicatePage,
    trashPage,
    restorePage,
    refresh,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
