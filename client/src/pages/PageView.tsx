import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowCounterClockwise,
  Copy,
  Download,
  FaceHappy,
  Image as ImageIcon,
  LinkChain,
  MoreHorizontalFill,
  PanelLeft,
  Star,
  TrashCan,
  Width,
} from '../lib/icons';
import type { PageFont, PageSummary, WorkspaceRole } from '@shared/types';
import type { FoliumEditor } from '../components/Editor';
import { EmojiPicker } from '../components/EmojiPicker';
import { PageIcon } from '../components/Sidebar';
import { useToast } from '../components/Toaster';
import {
  Avatar,
  Button,
  IconButton,
  MenuItem,
  MenuSeparator,
  Popover,
  Skeleton,
  Tooltip,
} from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { Pages } from '../lib/api';
import { useCollab, usePeers, type Collab } from '../lib/collab';
import { play } from '../lib/sound';
import { useTheme } from '../lib/theme';
import {
  bouncy,
  COVERS,
  coverStyle,
  cn,
  downloadText,
  LAST_PAGE_KEY,
  MOD,
  pageTitle,
  pick,
  RANDOM_ICONS,
  spring,
  timeAgo,
} from '../lib/utils';
import { useShell } from './AppShell';

// The editor (BlockNote + ProseMirror) is most of the bundle: load it with the first page.
const Editor = lazy(() => import('../components/Editor').then((m) => ({ default: m.Editor })));

export function PageView() {
  const { pageId = '' } = useParams();
  const ws = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const seed = (location.state as { seed?: 'welcome' } | null)?.seed;

  const [remote, setRemote] = useState<{ page: PageSummary; role: WorkspaceRole } | null>(null);
  const [missing, setMissing] = useState(false);
  const [editor, setEditor] = useState<FoliumEditor | null>(null);

  const { switchWorkspace } = ws;
  const currentWorkspace = ws.workspace?._id;

  // Resolve the page (it may belong to another workspace, or be in the trash).
  useEffect(() => {
    let live = true;
    setMissing(false);
    Pages.get(pageId)
      .then((res) => {
        if (!live) return;
        setRemote(res);
        localStorage.setItem(LAST_PAGE_KEY, pageId);
        if (currentWorkspace && res.page.workspace !== currentWorkspace)
          switchWorkspace(res.page.workspace, true);
      })
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [pageId, currentWorkspace, switchWorkspace]);

  const listed = ws.pagesById.get(pageId);
  const page = listed ?? (remote?.page._id === pageId ? remote.page : undefined);
  const role = remote?.page._id === pageId ? remote.role : ws.role;
  const deleted = !listed && Boolean(page?.deletedAt);
  const canEdit = role !== 'viewer' && !deleted;
  const collab = useCollab(page && !deleted ? pageId : null);

  useEffect(() => {
    if (page) document.title = `${page.icon ? `${page.icon} ` : ''}${pageTitle(page)} · Folium`;
  }, [page]);

  // The welcome seed is one-shot: drop it from history once used.
  const clearSeed = useCallback(
    () => navigate(location.pathname, { replace: true, state: null }),
    [navigate, location.pathname],
  );

  if (missing) return <NotFound />;
  if (!page) return <PageSkeleton />;

  return (
    <div className="flex h-full flex-col">
      <TopBar
        page={page}
        role={role}
        deleted={deleted}
        editor={editor}
        canEdit={canEdit}
        collab={collab}
      />
      {deleted && (
        <TrashBanner page={page} onChange={() => void Pages.get(pageId).then(setRemote)} />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <motion.div
          key={pageId}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="pb-[30vh]"
        >
          {page.coverImage && <Cover page={page} canEdit={canEdit} />}
          <div
            className={cn(
              'mx-auto w-full',
              page.fullWidth ? 'max-w-none px-4 sm:px-14' : 'max-w-[808px] px-2',
            )}
          >
            <PageHeader page={page} canEdit={canEdit} editor={editor} />
            {!deleted && (
              <EditorArea
                key={pageId}
                collab={collab}
                canEdit={canEdit}
                font={page.font}
                seed={seed}
                onSeeded={clearSeed}
                onReady={setEditor}
              />
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function EditorArea({
  collab,
  canEdit,
  font,
  seed,
  onSeeded,
  onReady,
}: {
  collab: Collab | null;
  canEdit: boolean;
  font: PageFont;
  seed?: 'welcome';
  onSeeded: () => void;
  onReady: (editor: FoliumEditor | null) => void;
}) {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const provider = collab?.provider;

  if (provider?.error) {
    return (
      <p className="px-[54px] py-6 text-[14px] text-muted">
        Couldn’t open this page: {provider.error}
      </p>
    );
  }
  if (!collab || !provider?.synced || !user) return <EditorSkeleton />;
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <Editor
        collab={collab}
        user={user}
        canEdit={canEdit && provider.canEdit}
        isDark={isDark}
        font={font}
        seed={seed}
        onSeeded={onSeeded}
        onReady={onReady}
      />
    </Suspense>
  );
}

function EditorSkeleton() {
  return (
    <div className="space-y-3 px-[54px] pt-4">
      {[92, 78, 85, 40].map((w) => (
        <Skeleton key={w} className="h-4" />
      ))}
    </div>
  );
}

function TopBar({
  page,
  role,
  deleted,
  editor,
  canEdit,
  collab,
}: {
  page: PageSummary;
  role: WorkspaceRole;
  deleted: boolean;
  editor: FoliumEditor | null;
  canEdit: boolean;
  collab: Collab | null;
}) {
  const ws = useWorkspace();
  const shell = useShell();
  const peers = usePeers(collab?.provider);
  const offline = collab?.provider.status === 'disconnected';

  return (
    <header className="flex h-12 shrink-0 items-center gap-1.5 px-3">
      {!shell.sidebarOpen && (
        <Tooltip label="Open sidebar" keys={[MOD, '\\']}>
          <IconButton aria-label="Open sidebar" onClick={shell.toggleSidebar}>
            <PanelLeft size={15} />
          </IconButton>
        </Tooltip>
      )}
      <Breadcrumbs page={page} />

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <AnimatePresence>
          {offline && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="mr-1 flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11.5px] font-medium text-amber-700 dark:text-amber-400"
            >
              <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
              Offline — edits will sync
            </motion.span>
          )}
        </AnimatePresence>
        {role === 'viewer' && (
          <span className="mr-1 rounded-full bg-hover px-2.5 py-1 text-[11.5px] font-medium text-muted">
            View only
          </span>
        )}
        <span className="mr-2 hidden text-[12px] text-faint lg:block">
          Edited {timeAgo(page.updatedAt)}
        </span>

        <div className="mr-1 flex -space-x-1.5">
          <AnimatePresence initial={false}>
            {peers.slice(0, 4).map((peer) => (
              <motion.span
                key={peer.clientId}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={bouncy}
              >
                <Tooltip label={`${peer.name} is here`}>
                  <Avatar
                    name={peer.name}
                    color={peer.color}
                    size={26}
                    className="ring-2 ring-surface"
                  />
                </Tooltip>
              </motion.span>
            ))}
          </AnimatePresence>
          {peers.length > 4 && (
            <span className="grid size-[26px] place-items-center rounded-full bg-hover text-[10.5px] font-semibold text-dim ring-2 ring-surface">
              +{peers.length - 4}
            </span>
          )}
        </div>

        <Button
          variant="ghost"
          className="h-7 px-2.5 text-[13px] font-medium"
          onClick={shell.openShare}
        >
          Share
        </Button>
        {!deleted && (
          <Tooltip label={page.isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
            <IconButton
              aria-label="Favorite"
              aria-pressed={page.isFavorite}
              onClick={() => void ws.toggleFavorite(page._id)}
            >
              <motion.span
                key={String(page.isFavorite)}
                initial={{ scale: 0.5, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={bouncy}
                className="grid"
              >
                <Star
                  size={15}
                  fill={page.isFavorite ? '#f5b400' : 'none'}
                  color={page.isFavorite ? '#f5b400' : 'currentColor'}
                />
              </motion.span>
            </IconButton>
          </Tooltip>
        )}
        {!deleted && <PageMenu page={page} editor={editor} canEdit={canEdit} />}
      </div>
    </header>
  );
}

function Breadcrumbs({ page }: { page: PageSummary }) {
  const ws = useWorkspace();
  const chain = [...ws.ancestorsOf(page._id), page];
  const shown = chain.length > 4 ? [chain[0]!, null, ...chain.slice(-2)] : chain;

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-0.5 text-[13.5px]">
      {shown.map((crumb, i) => (
        <span key={crumb?._id ?? 'gap'} className="flex min-w-0 items-center gap-0.5">
          {i > 0 && <span className="px-0.5 text-faint">/</span>}
          {crumb ? (
            <Link
              to={`/p/${crumb._id}`}
              className={cn(
                'hover-fill flex min-w-0 max-w-[180px] items-center gap-1.5 rounded-md px-1.5 py-1',
                crumb._id === page._id ? 'font-medium text-strong' : 'text-muted hover:text-strong',
              )}
            >
              <PageIcon page={crumb} size={14} />
              <span className="truncate">{pageTitle(crumb)}</span>
            </Link>
          ) : (
            <span className="px-1 text-faint">…</span>
          )}
        </span>
      ))}
    </nav>
  );
}

const FONTS: { id: PageFont; label: string; className: string }[] = [
  { id: 'sans', label: 'Default', className: 'font-sans' },
  { id: 'serif', label: 'Serif', className: 'font-serif' },
  { id: 'mono', label: 'Mono', className: 'font-mono' },
];

function PageMenu({
  page,
  editor,
  canEdit,
}: {
  page: PageSummary;
  editor: FoliumEditor | null;
  canEdit: boolean;
}) {
  const ws = useWorkspace();
  const toast = useToast();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const markdown = () => (editor ? editor.blocksToMarkdownLossy(editor.document) : '');
  const words = open
    ? markdown()
        .replace(/[#>*_`|[\]()-]/g, ' ')
        .split(/\s+/)
        .filter(Boolean).length
    : 0;

  return (
    <>
      <Tooltip label="Style, export and more">
        <IconButton
          ref={anchor}
          aria-label="Page options"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <MoreHorizontalFill size={15} />
        </IconButton>
      </Tooltip>
      <Popover
        anchor={anchor}
        open={open}
        onClose={close}
        placement="bottom-end"
        className="w-[248px]"
      >
        {canEdit && (
          <>
            <div className="grid grid-cols-3 gap-1 p-1">
              {FONTS.map((font) => (
                <button
                  key={font.id}
                  type="button"
                  onClick={() => void ws.updatePage(page._id, { font: font.id })}
                  className={cn(
                    'flex flex-col items-center gap-0.5 rounded-lg py-2 transition-colors',
                    page.font === font.id ? 'bg-hover text-accent' : 'text-dim hover:bg-hover',
                  )}
                >
                  <span className={cn('text-[22px] leading-none', font.className)}>Ag</span>
                  <span className="text-[11px] font-medium">{font.label}</span>
                </button>
              ))}
            </div>
            <MenuItem
              icon={<Width size={14} />}
              checked={page.fullWidth}
              onSelect={() => void ws.updatePage(page._id, { fullWidth: !page.fullWidth })}
            >
              Full width
            </MenuItem>
            <MenuSeparator />
          </>
        )}
        <MenuItem
          icon={<LinkChain size={14} />}
          onSelect={() => {
            close();
            void navigator.clipboard.writeText(`${location.origin}/p/${page._id}`);
            toast('Link copied');
          }}
        >
          Copy link
        </MenuItem>
        {canEdit && (
          <MenuItem
            icon={<Copy size={14} />}
            onSelect={() => {
              close();
              void ws.duplicatePage(page._id);
            }}
          >
            Duplicate
          </MenuItem>
        )}
        <MenuItem
          icon={<Download size={14} />}
          disabled={!editor}
          onSelect={() => {
            close();
            downloadText(`${pageTitle(page)}.md`, `# ${pageTitle(page)}\n\n${markdown()}`);
            play('tick');
          }}
        >
          Export as Markdown
        </MenuItem>
        {canEdit && (
          <>
            <MenuSeparator />
            <MenuItem
              danger
              icon={<TrashCan size={14} />}
              onSelect={() => {
                close();
                void ws.trashPage(page._id);
              }}
            >
              Move to trash
            </MenuItem>
          </>
        )}
        <MenuSeparator />
        <div className="space-y-0.5 px-2.5 py-1.5 text-[11.5px] text-faint">
          <p>Word count: {words.toLocaleString()}</p>
          <p>
            Created{' '}
            {new Date(page.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
          </p>
        </div>
      </Popover>
    </>
  );
}

function Cover({ page, canEdit }: { page: PageSummary; canEdit: boolean }) {
  const ws = useWorkspace();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const setLink = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const url = String(new FormData(e.currentTarget).get('url') ?? '').trim();
    if (/^https?:\/\//.test(url)) void ws.updatePage(page._id, { coverImage: url });
    close();
  };

  return (
    <div
      className="grain group/cover relative h-[min(30vh,280px)] w-full"
      style={{ background: coverStyle(page.coverImage ?? '') }}
    >
      {canEdit && (
        <div className="absolute bottom-3 right-4 flex gap-1 opacity-0 transition-opacity group-hover/cover:opacity-100 has-[[aria-expanded=true]]:opacity-100">
          <button
            ref={anchor}
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="rounded-lg bg-white/85 px-2.5 py-1 text-[12px] font-medium text-zinc-700 shadow-sm backdrop-blur hover:bg-white dark:bg-zinc-900/80 dark:text-zinc-200"
          >
            Change cover
          </button>
          <button
            type="button"
            onClick={() => void ws.updatePage(page._id, { coverImage: null })}
            className="rounded-lg bg-white/85 px-2.5 py-1 text-[12px] font-medium text-zinc-700 shadow-sm backdrop-blur hover:bg-white dark:bg-zinc-900/80 dark:text-zinc-200"
          >
            Remove
          </button>
        </div>
      )}
      <Popover
        anchor={anchor}
        open={open}
        onClose={close}
        placement="bottom-end"
        className="w-[300px] p-2"
      >
        <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
          Gradients
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {Object.entries(COVERS).map(([key, background]) => (
            <motion.button
              key={key}
              type="button"
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.95 }}
              transition={spring}
              aria-label={key}
              onClick={() => void ws.updatePage(page._id, { coverImage: `gradient:${key}` })}
              className={cn(
                'h-11 rounded-lg ring-offset-2 ring-offset-raised',
                page.coverImage === `gradient:${key}` && 'ring-2 ring-accent',
              )}
              style={{ background }}
            />
          ))}
        </div>
        <p className="px-1 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wider text-faint">
          Image link
        </p>
        <form onSubmit={setLink} className="flex gap-1.5">
          <input
            name="url"
            type="url"
            placeholder="https://…"
            className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-strong outline-none focus:border-accent/60"
          />
          <Button type="submit" variant="primary" className="h-8">
            Set
          </Button>
        </form>
      </Popover>
    </div>
  );
}

function PageHeader({
  page,
  canEdit,
  editor,
}: {
  page: PageSummary;
  canEdit: boolean;
  editor: FoliumEditor | null;
}) {
  const ws = useWorkspace();
  const iconRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [picker, setPicker] = useState(false);
  const [title, setTitle] = useState(page.title);
  const focused = useRef(false);
  const saveTimer = useRef<number | undefined>(undefined);
  const closePicker = useCallback(() => setPicker(false), []);

  // Follow remote renames unless the user is typing here.
  useEffect(() => {
    if (!focused.current) setTitle(page.title);
  }, [page.title]);

  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  // Auto-grow for browsers without `field-sizing: content`.
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [title, page.font, page.fullWidth]);

  const onTitle = (value: string) => {
    setTitle(value);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(
      () => void ws.updatePage(page._id, { title: value }),
      350,
    );
  };

  const focusEditor = () => {
    const first = editor?.document[0];
    if (!editor || !first) return;
    editor.setTextCursorPosition(first, 'start');
    editor.focus();
  };

  return (
    <div className={cn('group/header px-[54px]', page.coverImage ? 'pt-0' : 'pt-14')}>
      {page.icon && (
        <motion.button
          ref={iconRef}
          type="button"
          disabled={!canEdit}
          whileHover={canEdit ? { scale: 1.04 } : undefined}
          whileTap={canEdit ? { scale: 0.96 } : undefined}
          transition={spring}
          onClick={() => setPicker(true)}
          className={cn(
            'relative z-10 -ml-1.5 grid size-[84px] place-items-center rounded-2xl text-[64px] leading-none',
            canEdit && 'hover:bg-hover',
            page.coverImage && '-mt-[42px]',
          )}
          aria-label="Change icon"
        >
          {page.icon}
        </motion.button>
      )}

      {canEdit && (
        <div
          className={cn(
            'flex h-9 items-center gap-0.5 opacity-0 transition-opacity group-hover/header:opacity-100 focus-within:opacity-100',
            !page.icon && !page.coverImage && 'mt-6',
          )}
        >
          {!page.icon && (
            <Button
              variant="ghost"
              className="h-7 px-2 text-[12.5px] font-medium text-muted"
              onClick={() => void ws.updatePage(page._id, { icon: pick(RANDOM_ICONS) })}
            >
              <FaceHappy size={14} /> Add icon
            </Button>
          )}
          {!page.coverImage && (
            <Button
              variant="ghost"
              className="h-7 px-2 text-[12.5px] font-medium text-muted"
              onClick={() =>
                void ws.updatePage(page._id, {
                  coverImage: `gradient:${pick(Object.keys(COVERS))}`,
                })
              }
            >
              <ImageIcon size={14} /> Add cover
            </Button>
          )}
        </div>
      )}

      <textarea
        ref={textRef}
        rows={1}
        value={title}
        readOnly={!canEdit}
        placeholder="Untitled"
        aria-label="Page title"
        onFocus={() => (focused.current = true)}
        onBlur={() => (focused.current = false)}
        onChange={(e) => onTitle(e.target.value.replace(/\n/g, ' '))}
        onKeyDown={(e) => {
          if (
            e.key === 'Enter' ||
            (e.key === 'ArrowDown' && e.currentTarget.selectionStart === title.length)
          ) {
            e.preventDefault();
            focusEditor();
          }
        }}
        className={cn(
          'mb-2 mt-1 block w-full resize-none overflow-hidden bg-transparent text-[40px] font-bold leading-[1.2] tracking-tight text-strong outline-none [field-sizing:content] placeholder:text-faint/70',
          page.font === 'serif' && 'font-serif',
          page.font === 'mono' && 'font-mono text-[34px]',
        )}
      />

      <Popover anchor={iconRef} open={picker} onClose={closePicker} className="p-1">
        <EmojiPicker
          onPick={(emoji) => {
            closePicker();
            void ws.updatePage(page._id, { icon: emoji });
          }}
          onRemove={() => {
            closePicker();
            void ws.updatePage(page._id, { icon: null });
          }}
        />
      </Popover>
    </div>
  );
}

function TrashBanner({ page, onChange }: { page: PageSummary; onChange: () => void }) {
  const ws = useWorkspace();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 bg-red-500/10 px-4 py-2 text-[13px] text-red-700 dark:text-red-300">
      <span className="font-medium">This page is in the trash.</span>
      {ws.canEdit && (
        <>
          <Button
            className="h-7 border-red-500/30 bg-transparent text-red-700 hover:bg-red-500/10 dark:text-red-300"
            onClick={async () => {
              await ws.restorePage(page._id);
              onChange();
            }}
          >
            <ArrowCounterClockwise size={13} /> Restore
          </Button>
          <Button
            variant={confirm ? 'danger' : 'secondary'}
            className={cn(
              'h-7',
              !confirm &&
                'border-red-500/30 bg-transparent text-red-700 hover:bg-red-500/10 dark:text-red-300',
            )}
            onClick={async () => {
              if (!confirm) return setConfirm(true);
              await Pages.destroy(page._id);
              play('thunk');
              toast('Deleted forever');
              ws.refresh();
              navigate('/');
            }}
          >
            {confirm ? 'Click again to delete forever' : 'Delete forever'}
          </Button>
        </>
      )}
    </div>
  );
}

function NotFound() {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div>
        <p className="text-[44px]">🍃</p>
        <h1 className="mt-3 text-[18px] font-semibold text-strong">This page isn’t here</h1>
        <p className="mt-1 text-[13.5px] text-muted">
          It was deleted, or you don’t have access to it.
        </p>
        <Link to="/" className="mt-5 inline-flex">
          <Button variant="primary">Back to your pages</Button>
        </Link>
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-[808px] space-y-4 px-[62px] pt-28">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}
