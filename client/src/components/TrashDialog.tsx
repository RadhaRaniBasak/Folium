import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowCounterClockwise, Search, TrashCan } from '../lib/icons';
import type { PageSummary } from '@shared/types';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { Pages } from '../lib/api';
import { play } from '../lib/sound';
import { cn, pageTitle, spring, timeAgo } from '../lib/utils';
import { PageIcon } from './Sidebar';
import { Dialog, IconButton, Spinner, Tooltip } from './ui';
import { useToast } from './Toaster';

export function TrashDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} label="Trash" align="top" className="max-w-[540px]">
      <TrashBody onClose={onClose} />
    </Dialog>
  );
}

function TrashBody({ onClose }: { onClose: () => void }) {
  const ws = useWorkspace();
  const toast = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<PageSummary[] | null>(null);
  const [query, setQuery] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  const workspaceId = ws.workspace?._id;
  const load = useCallback(() => {
    if (!workspaceId) return;
    Pages.list(workspaceId, true)
      .then(setItems)
      .catch(() => setItems([]));
  }, [workspaceId]);

  useEffect(load, [load]);

  // Show only the top of each trashed subtree; subpages come back with their parent.
  const trashedIds = new Set(items?.map((p) => p._id));
  const visible = (items ?? [])
    .filter((p) => !p.parent || !trashedIds.has(p.parent))
    .filter((p) => pageTitle(p).toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''));

  const restore = async (page: PageSummary) => {
    await ws.restorePage(page._id);
    load();
  };

  const destroy = async (page: PageSummary) => {
    if (confirming !== page._id) {
      setConfirming(page._id);
      window.setTimeout(() => setConfirming((c) => (c === page._id ? null : c)), 3000);
      return;
    }
    try {
      await Pages.destroy(page._id);
      play('thunk');
      toast('Deleted forever');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete', { tone: 'error' });
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <TrashCan size={16} className="text-muted" />
        <h2 className="text-[14px] font-semibold text-strong">Trash</h2>
        <label className="ml-auto flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5">
          <Search size={13} className="text-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by title"
            className="h-8 w-40 bg-transparent text-[13px] text-strong outline-none placeholder:text-faint"
          />
        </label>
      </div>

      <div className="max-h-[50vh] overflow-y-auto p-1.5">
        {items === null ? (
          <div className="grid place-items-center py-10">
            <Spinner />
          </div>
        ) : visible.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[13.5px] font-medium text-dim">
              {query ? 'No matches' : 'Trash is empty'}
            </p>
            <p className="mt-1 text-[12.5px] text-faint">
              Deleted pages stay here until you remove them for good.
            </p>
          </div>
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {visible.map((page) => {
                const parent = page.parent ? ws.pagesById.get(page.parent) : undefined;
                return (
                  <motion.li
                    key={page._id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, x: -12, transition: { duration: 0.15 } }}
                    transition={spring}
                    className="hover-fill group flex items-center gap-2.5 rounded-lg px-2.5 py-2"
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      onClick={() => {
                        onClose();
                        navigate(`/p/${page._id}`);
                      }}
                    >
                      <PageIcon page={page} />
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-medium text-strong">
                          {pageTitle(page)}
                        </span>
                        <span className="block truncate text-[12px] text-muted">
                          {parent ? `in ${pageTitle(parent)} · ` : ''}deleted{' '}
                          {timeAgo(page.deletedAt ?? page.updatedAt)}
                        </span>
                      </span>
                    </button>
                    {ws.canEdit && (
                      <span className="flex items-center gap-0.5">
                        <Tooltip label="Restore">
                          <IconButton aria-label="Restore" onClick={() => void restore(page)}>
                            <ArrowCounterClockwise size={14} />
                          </IconButton>
                        </Tooltip>
                        <button
                          type="button"
                          onClick={() => void destroy(page)}
                          className={cn(
                            'h-7 rounded-md px-2 text-[12px] font-semibold transition-colors',
                            confirming === page._id
                              ? 'bg-red-600 text-white'
                              : 'text-muted hover:bg-red-500/10 hover:text-red-600',
                          )}
                        >
                          {confirming === page._id ? 'Delete forever?' : 'Delete'}
                        </button>
                      </span>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}
