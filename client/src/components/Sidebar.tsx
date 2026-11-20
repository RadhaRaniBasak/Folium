import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { NavLink, useMatch } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  File,
  LinkChain,
  MoreHorizontalFill,
  PanelLeft,
  Pencil,
  PersonAdd,
  Plus,
  Search,
  SignOut,
  SoundOff,
  SoundOn,
  Star,
  TrashCan,
} from '../lib/icons';
import type { PageSummary } from '@shared/types';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { setSoundsEnabled, soundsEnabled } from '../lib/sound';
import { useTheme, type ThemePref } from '../lib/theme';
import { ALT, cn, MOD, pageTitle, spring, timeAgo } from '../lib/utils';
import { IconButton, Kbd, MenuItem, MenuLabel, MenuSeparator, Popover, Tooltip } from './ui';
import { useToast } from './Toaster';

const EXPANDED_KEY = 'folium:expanded';
type Zone = 'before' | 'after' | 'inside';

interface Dnd {
  dragId: string | null;
  target: { id: string; zone: Zone } | null;
  start: (e: DragEvent, id: string) => void;
  over: (e: DragEvent, page: PageSummary) => void;
  drop: (e: DragEvent, page: PageSummary) => void;
  end: () => void;
}

interface Props {
  onOpenPalette: () => void;
  onOpenTrash: () => void;
  onOpenShare: () => void;
  onCollapse: () => void;
}

export function Sidebar({ onOpenPalette, onOpenTrash, onOpenShare, onCollapse }: Props) {
  const ws = useWorkspace();
  const activeId = useMatch('/p/:pageId')?.params.pageId ?? null;

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? '[]') as string[]);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify([...expanded]));
  }, [expanded]);

  const setOpen = useCallback((id: string, open: boolean) => {
    setExpanded((prev) => {
      if (prev.has(id) === open) return prev;
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  // Reveal the open page in the tree.
  const { ancestorsOf } = ws;
  useEffect(() => {
    if (activeId) ancestorsOf(activeId).forEach((p) => setOpen(p._id, true));
  }, [activeId, ancestorsOf, setOpen]);

  const dnd = useTreeDnd((id) => setOpen(id, true));
  const favorites = ws.pages.filter((p) => p.isFavorite);
  const roots = ws.childrenOf(null);
  const [rootDrop, setRootDrop] = useState(false);

  return (
    <div className="flex h-full w-[264px] flex-col">
      <div className="flex items-center gap-1 p-2 pb-1">
        <WorkspaceSwitcher />
        <Tooltip label="Close sidebar" keys={[MOD, '\\']}>
          <IconButton aria-label="Close sidebar" onClick={onCollapse}>
            <PanelLeft size={15} />
          </IconButton>
        </Tooltip>
      </div>

      <div className="space-y-px px-2 pb-2">
        <SidebarAction
          icon={<Search size={15} />}
          label="Search"
          keys={[MOD, 'K']}
          onClick={onOpenPalette}
        />
        {ws.canEdit && (
          <SidebarAction
            icon={<Plus size={15} />}
            label="New page"
            keys={[MOD, ALT, 'N']}
            onClick={() => void ws.createPage(null)}
          />
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4" aria-label="Pages">
        <AnimatePresence initial={false}>
          {favorites.length > 0 && (
            <motion.section
              key="favorites"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={spring}
              className="mb-3 overflow-hidden"
            >
              <SectionLabel>Favorites</SectionLabel>
              <ul>
                {favorites.map((page) => (
                  <li key={page._id}>
                    <PageLink page={page} active={page._id === activeId} depth={0} />
                  </li>
                ))}
              </ul>
            </motion.section>
          )}
        </AnimatePresence>

        <section>
          <div
            className={cn('group flex items-center rounded-md pr-1', rootDrop && 'bg-accent/10')}
            onDragOver={(e) => {
              if (!dnd.dragId) return;
              e.preventDefault();
              setRootDrop(true);
            }}
            onDragLeave={() => setRootDrop(false)}
            onDrop={(e) => {
              e.preventDefault();
              setRootDrop(false);
              if (dnd.dragId) {
                const last = roots.filter((p) => p._id !== dnd.dragId).at(-1);
                void ws.updatePage(dnd.dragId, { parent: null, order: (last?.order ?? 0) + 1 });
              }
              dnd.end();
            }}
          >
            <SectionLabel>Pages</SectionLabel>
            {ws.canEdit && (
              <Tooltip label="Add a page">
                <IconButton
                  className="ml-auto size-6 opacity-0 group-hover:opacity-100"
                  aria-label="Add a page"
                  onClick={() => void ws.createPage(null)}
                >
                  <Plus size={13} />
                </IconButton>
              </Tooltip>
            )}
          </div>

          {ws.loading ? (
            <div className="space-y-2 px-2 pt-1">
              {[70, 55, 80, 45].map((w) => (
                <div
                  key={w}
                  className="h-3.5 animate-pulse rounded bg-hover"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          ) : roots.length === 0 ? (
            <p className="px-2 py-1 text-[12.5px] text-faint">No pages yet.</p>
          ) : (
            <ul role="tree">
              {roots.map((page) => (
                <TreeItem
                  key={page._id}
                  page={page}
                  depth={0}
                  activeId={activeId}
                  expanded={expanded}
                  setOpen={setOpen}
                  dnd={dnd}
                />
              ))}
            </ul>
          )}
        </section>
      </nav>

      <div className="space-y-px border-t border-line p-2">
        <SidebarAction icon={<TrashCan size={15} />} label="Trash" onClick={onOpenTrash} />
        <SidebarAction
          icon={<PersonAdd size={15} />}
          label="Invite members"
          onClick={onOpenShare}
        />
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="select-none px-2 pb-1 pt-2 text-[11.5px] font-semibold tracking-wide text-faint">
      {children}
    </p>
  );
}

function SidebarAction({
  icon,
  label,
  keys,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  keys?: string[];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover-fill group flex h-[30px] w-full items-center gap-2.5 rounded-lg px-2 text-[13.5px] font-medium text-dim transition-colors hover:text-strong"
    >
      <span className="text-muted">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {keys && <Kbd keys={keys} className="opacity-0 transition-opacity group-hover:opacity-100" />}
    </button>
  );
}

function PageLink({ page, active, depth }: { page: PageSummary; active: boolean; depth: number }) {
  return (
    <NavLink
      to={`/p/${page._id}`}
      draggable={false}
      data-active={active}
      className={cn(
        'hover-fill flex h-[30px] items-center gap-2 rounded-lg pr-2 text-[13.5px] font-medium transition-colors',
        active ? 'text-strong' : 'text-dim hover:text-strong',
      )}
      style={{ paddingLeft: 8 + depth * 14 }}
    >
      <PageIcon page={page} />
      <span className="truncate">{pageTitle(page)}</span>
    </NavLink>
  );
}

export function PageIcon({ page, size = 15 }: { page: Pick<PageSummary, 'icon'>; size?: number }) {
  return (
    <span
      className="grid size-5 shrink-0 place-items-center leading-none"
      style={{ fontSize: size }}
    >
      {page.icon ?? <File size={size} className="text-faint" />}
    </span>
  );
}

function TreeItem({
  page,
  depth,
  activeId,
  expanded,
  setOpen,
  dnd,
}: {
  page: PageSummary;
  depth: number;
  activeId: string | null;
  expanded: Set<string>;
  setOpen: (id: string, open: boolean) => void;
  dnd: Dnd;
}) {
  const ws = useWorkspace();
  const toast = useToast();
  const kids = ws.childrenOf(page._id);
  const isOpen = expanded.has(page._id);
  const active = page._id === activeId;
  const indicator = dnd.target?.id === page._id ? dnd.target.zone : null;

  const moreRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const rename = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = new FormData(e.currentTarget).get('title');
    setRenaming(false);
    if (typeof value === 'string' && value !== page.title)
      void ws.updatePage(page._id, { title: value });
  };

  return (
    <li role="treeitem" aria-expanded={isOpen} aria-selected={active}>
      <div
        draggable={ws.canEdit && !renaming}
        onDragStart={(e) => dnd.start(e, page._id)}
        onDragOver={(e) => dnd.over(e, page)}
        onDrop={(e) => dnd.drop(e, page)}
        onDragEnd={dnd.end}
        data-active={active}
        className={cn(
          'hover-fill group relative flex h-[30px] items-center rounded-lg pr-1 text-[13.5px] font-medium',
          dnd.dragId === page._id && 'opacity-40',
          indicator === 'inside' && 'bg-accent/10 ring-1 ring-accent/40',
        )}
        style={{ paddingLeft: 4 + depth * 14 }}
      >
        {indicator === 'before' && (
          <span className="absolute -top-px left-2 right-2 h-0.5 rounded-full bg-accent" />
        )}
        {indicator === 'after' && (
          <span className="absolute -bottom-px left-2 right-2 h-0.5 rounded-full bg-accent" />
        )}

        <button
          type="button"
          aria-label={isOpen ? 'Collapse' : 'Expand'}
          onClick={() => setOpen(page._id, !isOpen)}
          className="grid size-5 shrink-0 place-items-center rounded text-faint transition-colors hover:bg-hover hover:text-dim"
        >
          <motion.span animate={{ rotate: isOpen ? 90 : 0 }} transition={spring} className="grid">
            <ChevronRight size={11} strokeWidth={2.6} />
          </motion.span>
        </button>

        {renaming ? (
          <form onSubmit={rename} className="flex min-w-0 flex-1 items-center gap-1.5 pl-0.5">
            <PageIcon page={page} />
            <input
              name="title"
              autoFocus
              defaultValue={page.title}
              placeholder="Untitled"
              onBlur={(e) => e.currentTarget.form?.requestSubmit()}
              onKeyDown={(e) => e.key === 'Escape' && setRenaming(false)}
              className="min-w-0 flex-1 rounded-md border border-line bg-raised px-1.5 py-0.5 text-[13px] text-strong outline-none focus:border-accent/60"
            />
          </form>
        ) : (
          <NavLink
            to={`/p/${page._id}`}
            draggable={false}
            className={cn(
              'flex min-w-0 flex-1 items-center gap-1.5 py-1 pl-0.5 outline-none transition-colors',
              active ? 'text-strong' : 'text-dim hover:text-strong',
            )}
          >
            <PageIcon page={page} />
            <span className="truncate">{pageTitle(page)}</span>
          </NavLink>
        )}

        {ws.canEdit && !renaming && (
          <span
            className={cn(
              'flex items-center opacity-0 transition-opacity group-hover:opacity-100',
              menuOpen && 'opacity-100',
            )}
          >
            <IconButton
              ref={moreRef}
              className="size-6"
              aria-label="Page actions"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <MoreHorizontalFill size={13} />
            </IconButton>
            <IconButton
              className="size-6"
              aria-label="Add a page inside"
              onClick={() => {
                setOpen(page._id, true);
                void ws.createPage(page._id);
              }}
            >
              <Plus size={13} />
            </IconButton>
          </span>
        )}

        <Popover anchor={moreRef} open={menuOpen} onClose={closeMenu} placement="right-start">
          <MenuItem
            icon={<Star size={14} />}
            onSelect={() => {
              closeMenu();
              void ws.toggleFavorite(page._id);
            }}
          >
            {page.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          </MenuItem>
          <MenuItem
            icon={<Pencil size={14} />}
            onSelect={() => {
              closeMenu();
              setRenaming(true);
            }}
          >
            Rename
          </MenuItem>
          <MenuItem
            icon={<Copy size={14} />}
            onSelect={() => {
              closeMenu();
              void ws.duplicatePage(page._id);
            }}
          >
            Duplicate
          </MenuItem>
          <MenuItem
            icon={<LinkChain size={14} />}
            onSelect={() => {
              closeMenu();
              void navigator.clipboard.writeText(`${location.origin}/p/${page._id}`);
              toast('Link copied');
            }}
          >
            Copy link
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            danger
            icon={<TrashCan size={14} />}
            onSelect={() => {
              closeMenu();
              void ws.trashPage(page._id);
            }}
          >
            Move to trash
          </MenuItem>
          <MenuSeparator />
          <p className="px-2.5 py-1 text-[11.5px] text-faint">Edited {timeAgo(page.updatedAt)}</p>
        </Popover>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.ul
            role="group"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring}
            className="overflow-hidden"
          >
            {kids.length > 0 ? (
              kids.map((kid) => (
                <TreeItem
                  key={kid._id}
                  page={kid}
                  depth={depth + 1}
                  activeId={activeId}
                  expanded={expanded}
                  setOpen={setOpen}
                  dnd={dnd}
                />
              ))
            ) : (
              <li
                className="py-1 text-[12.5px] text-faint"
                style={{ paddingLeft: 30 + (depth + 1) * 14 }}
              >
                No pages inside
              </li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
}

/** Drag a page onto another: top/bottom edge reorders, the middle nests it inside. */
function useTreeDnd(expand: (id: string) => void): Dnd {
  const ws = useWorkspace();
  const [dragId, setDragId] = useState<string | null>(null);
  const [target, setTarget] = useState<Dnd['target']>(null);

  const isInside = (pageId: string, ancestorId: string) => {
    let cursor: string | null = pageId;
    while (cursor) {
      if (cursor === ancestorId) return true;
      cursor = ws.pagesById.get(cursor)?.parent ?? null;
    }
    return false;
  };

  const end = () => {
    setDragId(null);
    setTarget(null);
  };

  return {
    dragId,
    target,
    end,
    start(e, id) {
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.effectAllowed = 'move';
      setDragId(id);
    },
    over(e, page) {
      if (!dragId || isInside(page._id, dragId)) return; // can't drop into itself or its subpages
      e.preventDefault();
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const zone: Zone =
        y < rect.height * 0.28 ? 'before' : y > rect.height * 0.72 ? 'after' : 'inside';
      if (target?.id !== page._id || target.zone !== zone) setTarget({ id: page._id, zone });
    },
    drop(e, page) {
      e.preventDefault();
      e.stopPropagation();
      if (!dragId || !target || target.id !== page._id) return end();

      const parentKey = page.parent && ws.pagesById.has(page.parent) ? page.parent : null;
      if (target.zone === 'inside') {
        const last = ws
          .childrenOf(page._id)
          .filter((p) => p._id !== dragId)
          .at(-1);
        void ws.updatePage(dragId, { parent: page._id, order: (last?.order ?? 0) + 1 });
        expand(page._id);
      } else {
        const siblings = ws.childrenOf(parentKey).filter((p) => p._id !== dragId);
        const at = siblings.findIndex((p) => p._id === page._id);
        const neighbour = target.zone === 'before' ? siblings[at - 1] : siblings[at + 1];
        const order = neighbour
          ? (neighbour.order + page.order) / 2
          : page.order + (target.zone === 'before' ? -1 : 1);
        void ws.updatePage(dragId, { parent: parentKey, order });
      }
      end();
    },
  };
}

function WorkspaceSwitcher() {
  const ws = useWorkspace();
  const { user, logout } = useAuth();
  const theme = useTheme();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sounds, setSounds] = useState(soundsEnabled);
  const close = useCallback(() => {
    setOpen(false);
    setCreating(false);
  }, []);
  const name = ws.workspace?.name ?? 'Workspace';

  return (
    <>
      <button
        ref={anchor}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="hover-fill flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1.5 text-left"
      >
        <WorkspaceMark name={name} />
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-strong">
          {name}
        </span>
        <ChevronDown size={11} strokeWidth={2.6} className="text-faint" />
      </button>

      <Popover anchor={anchor} open={open} onClose={close} className="w-[260px]">
        <div className="px-2.5 pb-1.5 pt-1">
          <p className="truncate text-[13px] font-semibold text-strong">{user?.name}</p>
          <p className="truncate text-[12px] text-muted">{user?.email}</p>
        </div>
        <MenuSeparator />
        <MenuLabel>Workspaces</MenuLabel>
        {ws.workspaces.map((w) => (
          <MenuItem
            key={w._id}
            icon={<WorkspaceMark name={w.name} small />}
            checked={w._id === ws.workspace?._id}
            onSelect={() => {
              close();
              ws.switchWorkspace(w._id);
            }}
          >
            {w.name}
          </MenuItem>
        ))}
        {creating ? (
          <form
            className="p-1"
            onSubmit={(e) => {
              e.preventDefault();
              const value = String(new FormData(e.currentTarget).get('name') ?? '').trim();
              if (value) void ws.createWorkspace(value);
              close();
            }}
          >
            <input
              name="name"
              autoFocus
              placeholder="Workspace name"
              className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] text-strong outline-none focus:border-accent/60"
            />
          </form>
        ) : (
          <MenuItem icon={<Plus size={14} />} onSelect={() => setCreating(true)}>
            New workspace
          </MenuItem>
        )}
        <MenuSeparator />
        <MenuLabel>Appearance</MenuLabel>
        <div className="mx-1 mb-1 grid grid-cols-3 gap-0.5 rounded-lg bg-hover p-0.5">
          {(['light', 'dark', 'system'] as ThemePref[]).map((pref) => (
            <button
              key={pref}
              type="button"
              onClick={() => theme.setPref(pref)}
              className={cn(
                'relative rounded-md py-1 text-[12px] font-medium capitalize transition-colors',
                theme.pref === pref ? 'text-strong' : 'text-muted hover:text-dim',
              )}
            >
              {theme.pref === pref && (
                <motion.span
                  layoutId="theme-pill"
                  transition={spring}
                  className="absolute inset-0 rounded-md bg-raised shadow-sm"
                />
              )}
              <span className="relative">{pref}</span>
            </button>
          ))}
        </div>
        <MenuItem
          icon={sounds ? <SoundOn size={14} /> : <SoundOff size={14} />}
          checked={sounds}
          onSelect={() => {
            setSoundsEnabled(!sounds);
            setSounds(!sounds);
          }}
        >
          Interface sounds
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<SignOut size={14} />} onSelect={() => void logout()}>
          Log out
        </MenuItem>
      </Popover>
    </>
  );
}

export function WorkspaceMark({ name, small }: { name: string; small?: boolean }) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-md bg-gradient-to-br from-emerald-400 to-teal-600 font-bold text-white shadow-sm',
        small ? 'size-4 text-[9px]' : 'size-[22px] text-[11px]',
      )}
    >
      {name.trim()[0]?.toUpperCase() ?? 'F'}
    </span>
  );
}
