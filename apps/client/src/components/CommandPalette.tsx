import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Moon, PanelLeft, Plus, Search, SignOut, SoundOn, Sun, TrashCan } from '../lib/icons';
import type { SearchResult } from '@shared/types';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { Pages } from '../lib/api';
import { setSoundsEnabled, soundsEnabled } from '../lib/sound';
import { useTheme } from '../lib/theme';
import { ALT, MOD, pageTitle, SHIFT, spring, timeAgo } from '../lib/utils';
import { PageIcon } from './Sidebar';
import { Dialog, Kbd } from './ui';
import { useToast } from './Toaster';

interface Item {
  id: string;
  group: 'Recent' | 'Pages' | 'In page content' | 'Actions';
  label: string;
  detail?: string;
  icon: ReactNode;
  keys?: string[];
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenTrash: () => void;
  onToggleSidebar: () => void;
}

export function CommandPalette({ open, onClose, onOpenTrash, onToggleSidebar }: Props) {
  return (
    <Dialog open={open} onClose={onClose} align="top" label="Search" className="max-w-[620px]">
      <PaletteBody onClose={onClose} onOpenTrash={onOpenTrash} onToggleSidebar={onToggleSidebar} />
    </Dialog>
  );
}

function PaletteBody({ onClose, onOpenTrash, onToggleSidebar }: Omit<Props, 'open'>) {
  const ws = useWorkspace();
  const { logout } = useAuth();
  const theme = useTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [contentHits, setContentHits] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const q = query.trim().toLowerCase();

  // Full-text matches come from the server (debounced).
  useEffect(() => {
    if (!q || !ws.workspace) {
      setContentHits([]);
      return;
    }
    const id = ws.workspace._id;
    const timer = window.setTimeout(() => {
      Pages.search(id, q)
        .then(setContentHits)
        .catch(() => setContentHits([]));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [q, ws.workspace]);

  const items = useMemo<Item[]>(() => {
    const open = (id: string) => () => {
      onClose();
      navigate(`/p/${id}`);
    };
    const pathOf = (id: string) =>
      ws
        .ancestorsOf(id)
        .map((p) => pageTitle(p))
        .join(' / ');

    const actions: Item[] = [
      ...(ws.canEdit
        ? [
            {
              id: 'new',
              group: 'Actions' as const,
              label: q ? `New page “${query.trim()}”` : 'New page',
              icon: <Plus size={15} />,
              keys: [MOD, ALT, 'N'],
              run: () => {
                onClose();
                void ws.createPage(null, { title: query.trim() || undefined });
              },
            },
          ]
        : []),
      {
        id: 'theme',
        group: 'Actions',
        label: theme.isDark ? 'Switch to light mode' : 'Switch to dark mode',
        icon: theme.isDark ? <Sun size={15} /> : <Moon size={15} />,
        keys: [MOD, SHIFT, 'L'],
        run: () => {
          theme.toggle();
          onClose();
        },
      },
      {
        id: 'sidebar',
        group: 'Actions',
        label: 'Toggle sidebar',
        icon: <PanelLeft size={15} />,
        keys: [MOD, '\\'],
        run: () => {
          onToggleSidebar();
          onClose();
        },
      },
      {
        id: 'trash',
        group: 'Actions',
        label: 'Open trash',
        icon: <TrashCan size={15} />,
        run: () => {
          onClose();
          onOpenTrash();
        },
      },
      {
        id: 'sounds',
        group: 'Actions',
        label: soundsEnabled() ? 'Turn interface sounds off' : 'Turn interface sounds on',
        icon: <SoundOn size={15} />,
        run: () => {
          setSoundsEnabled(!soundsEnabled());
          toast(soundsEnabled() ? 'Sounds on' : 'Sounds off');
          onClose();
        },
      },
      {
        id: 'logout',
        group: 'Actions',
        label: 'Log out',
        icon: <SignOut size={15} />,
        run: () => void logout(),
      },
    ];

    if (!q) {
      const recent = [...ws.pages]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 6)
        .map<Item>((p) => ({
          id: p._id,
          group: 'Recent',
          label: pageTitle(p),
          detail: pathOf(p._id) || `Edited ${timeAgo(p.updatedAt)}`,
          icon: <PageIcon page={p} />,
          run: open(p._id),
        }));
      return [...recent, ...actions];
    }

    const titleHits = ws.pages
      .filter((p) => pageTitle(p).toLowerCase().includes(q))
      .sort(
        (a, b) =>
          Number(!pageTitle(a).toLowerCase().startsWith(q)) -
          Number(!pageTitle(b).toLowerCase().startsWith(q)),
      )
      .slice(0, 8);
    const seen = new Set(titleHits.map((p) => p._id));

    return [
      ...titleHits.map<Item>((p) => ({
        id: p._id,
        group: 'Pages',
        label: pageTitle(p),
        detail: pathOf(p._id),
        icon: <PageIcon page={p} />,
        run: open(p._id),
      })),
      ...contentHits
        .filter((hit) => !seen.has(hit._id) && hit.snippet)
        .map<Item>((hit) => ({
          id: `content-${hit._id}`,
          group: 'In page content',
          label: pageTitle(hit),
          detail: hit.snippet ?? undefined,
          icon: <PageIcon page={hit} />,
          run: open(hit._id),
        })),
      ...actions.filter((a) => a.id === 'new' || a.label.toLowerCase().includes(q)),
    ];
  }, [
    q,
    query,
    ws,
    contentHits,
    theme,
    navigate,
    onClose,
    onOpenTrash,
    onToggleSidebar,
    logout,
    toast,
  ]);

  useEffect(() => setActive(0), [q]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[active]?.run();
    }
  };

  let lastGroup = '';

  return (
    <div onKeyDown={onKeyDown}>
      <label className="flex items-center gap-3 border-b border-line px-4">
        <Search size={17} className="shrink-0 text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${ws.workspace?.name ?? 'pages'}…`}
          className="h-[52px] w-full bg-transparent text-[15px] text-strong outline-none placeholder:text-faint"
          aria-label="Search pages and actions"
          aria-activedescendant={items[active] ? `cmd-${items[active].id}` : undefined}
        />
        <Kbd keys={['esc']} />
      </label>

      <div ref={listRef} role="listbox" className="max-h-[min(420px,55vh)] overflow-y-auto p-1.5">
        {items.length === 0 && (
          <p className="px-3 py-8 text-center text-[13px] text-muted">No results</p>
        )}
        {items.map((item, index) => {
          const header = item.group !== lastGroup ? item.group : null;
          lastGroup = item.group;
          return (
            <div key={item.id}>
              {header && (
                <p className="px-2.5 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
                  {header}
                </p>
              )}
              <button
                id={`cmd-${item.id}`}
                type="button"
                role="option"
                aria-selected={index === active}
                data-index={index}
                onMouseMove={() => index !== active && setActive(index)}
                onClick={item.run}
                className="relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left"
              >
                {index === active && (
                  <motion.span
                    layoutId="cmd-active"
                    transition={spring}
                    className="absolute inset-0 rounded-lg bg-hover"
                  />
                )}
                <span className="relative grid size-5 shrink-0 place-items-center text-muted">
                  {item.icon}
                </span>
                <span className="relative min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-strong">
                    {item.label}
                  </span>
                  {item.detail && (
                    <span className="block truncate text-[12px] text-muted">{item.detail}</span>
                  )}
                </span>
                {item.keys && <Kbd keys={item.keys} className="relative" />}
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-[11.5px] text-muted">
        <span className="flex items-center gap-1.5">
          <Kbd keys={['↑']} />
          <Kbd keys={['↓']} /> navigate
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd keys={['↵']} /> open
        </span>
        <span className="ml-auto hidden sm:block">Searches titles and page content</span>
      </div>
    </div>
  );
}
