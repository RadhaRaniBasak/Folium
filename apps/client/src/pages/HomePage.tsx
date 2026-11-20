import { Navigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { PanelLeft, Plus } from '../lib/icons';
import { Button, IconButton, Kbd, Spinner, Tooltip } from '../components/ui';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { ALT, MOD, spring } from '../lib/utils';
import { useShell } from './AppShell';
import { LAST_PAGE_KEY } from '../lib/utils';

/** Opens the last visited page, the first page, or an empty state. */
export function HomePage() {
  const ws = useWorkspace();
  const shell = useShell();

  if (ws.loading) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    );
  }

  const last = localStorage.getItem(LAST_PAGE_KEY);
  if (last && ws.pagesById.has(last)) return <Navigate to={`/p/${last}`} replace />;
  const first = ws.childrenOf(null)[0];
  if (first) return <Navigate to={`/p/${first._id}`} replace />;

  return (
    <div className="relative grid h-full place-items-center px-6">
      {!shell.sidebarOpen && (
        <div className="absolute left-3 top-2.5">
          <Tooltip label="Open sidebar" keys={[MOD, '\\']}>
            <IconButton aria-label="Open sidebar" onClick={shell.toggleSidebar}>
              <PanelLeft size={15} />
            </IconButton>
          </Tooltip>
        </div>
      )}
      <div className="flex max-w-sm flex-col items-center text-center">
        <StackedPages />
        <h1 className="mt-8 text-[19px] font-semibold tracking-tight text-strong">
          Nothing here yet
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
          Pages you create appear in the sidebar. Nest them, star them, and edit them together in
          real time.
        </p>
        {ws.canEdit && (
          <Button variant="primary" className="mt-6" onClick={() => void ws.createPage(null)}>
            <Plus size={14} /> New page
          </Button>
        )}
        <p className="mt-4 flex items-center gap-2 text-[12px] text-faint">
          <Kbd keys={[MOD, ALT, 'N']} /> new page <span className="text-line">·</span>{' '}
          <Kbd keys={[MOD, 'K']} /> search
        </p>
      </div>
    </div>
  );
}

/** Three cards that fan out on load. */
function StackedPages() {
  const cards = [
    { rotate: -9, x: -30, delay: 0.05, emoji: '📚' },
    { rotate: 8, x: 30, delay: 0.12, emoji: '🚀' },
    { rotate: 0, x: 0, delay: 0.2, emoji: '🌿' },
  ];
  return (
    <div className="relative h-28 w-40">
      {cards.map((card) => (
        <motion.div
          key={card.emoji}
          initial={{ opacity: 0, y: 20, rotate: 0, x: 0 }}
          animate={{ opacity: 1, y: 0, rotate: card.rotate, x: card.x }}
          transition={{ ...spring, delay: card.delay }}
          className="absolute inset-x-6 inset-y-0 rounded-2xl border border-line bg-raised p-3 shadow-float"
        >
          <span className="text-[22px]">{card.emoji}</span>
          <div className="mt-2 space-y-1.5">
            <div className="h-1.5 w-3/4 rounded-full bg-hover" />
            <div className="h-1.5 w-1/2 rounded-full bg-hover" />
            <div className="h-1.5 w-2/3 rounded-full bg-hover" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
