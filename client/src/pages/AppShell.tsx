import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'motion/react';
import { CommandPalette } from '../components/CommandPalette';
import { ShareDialog } from '../components/ShareDialog';
import { Sidebar } from '../components/Sidebar';
import { TrashDialog } from '../components/TrashDialog';
import { useWorkspace, WorkspaceProvider } from '../contexts/WorkspaceContext';
import { useTheme } from '../lib/theme';
import { cn, isMac, spring } from '../lib/utils';

interface Shell {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  openPalette: () => void;
  openShare: () => void;
  openTrash: () => void;
}

const ShellContext = createContext<Shell | null>(null);

export function useShell(): Shell {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used within AppShell');
  return ctx;
}

const SIDEBAR_KEY = 'folium:sidebar';

export function AppShell() {
  return (
    <WorkspaceProvider>
      <ShellLayout />
    </WorkspaceProvider>
  );
}

function ShellLayout() {
  const ws = useWorkspace();
  const theme = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.innerWidth >= 768 && localStorage.getItem(SIDEBAR_KEY) !== 'closed',
  );
  const [palette, setPalette] = useState(false);
  const [trash, setTrash] = useState(false);
  const [share, setShare] = useState(false);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, sidebarOpen ? 'open' : 'closed');
  }, [sidebarOpen]);

  const toggleSidebar = useCallback(() => setSidebarOpen((o) => !o), []);
  const { createPage, canEdit } = ws;
  const { toggle: toggleTheme } = theme;

  // Global shortcuts. `e.code` keeps them working with ⌥ on macOS.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(isMac ? e.metaKey : e.ctrlKey)) return;
      if (e.code === 'KeyK') {
        e.preventDefault();
        setPalette((o) => !o);
      } else if (e.code === 'Backslash') {
        e.preventDefault();
        toggleSidebar();
      } else if (e.code === 'KeyL' && e.shiftKey) {
        e.preventDefault();
        toggleTheme();
      } else if (e.code === 'KeyN' && e.altKey && canEdit) {
        e.preventDefault();
        void createPage(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleSidebar, toggleTheme, createPage, canEdit]);

  const shell = useMemo<Shell>(
    () => ({
      sidebarOpen,
      toggleSidebar,
      openPalette: () => setPalette(true),
      openShare: () => setShare(true),
      openTrash: () => setTrash(true),
    }),
    [sidebarOpen, toggleSidebar],
  );

  const closePalette = useCallback(() => setPalette(false), []);
  const closeTrash = useCallback(() => setTrash(false), []);
  const closeShare = useCallback(() => setShare(false), []);

  return (
    <ShellContext.Provider value={shell}>
      <div className="flex h-dvh overflow-hidden bg-surface">
        <motion.aside
          initial={false}
          animate={{ width: sidebarOpen ? 264 : 0 }}
          transition={spring}
          className={cn(
            'relative shrink-0 overflow-hidden bg-sidebar',
            sidebarOpen && 'border-r border-line',
          )}
          aria-hidden={!sidebarOpen}
        >
          <Sidebar
            onOpenPalette={shell.openPalette}
            onOpenTrash={shell.openTrash}
            onOpenShare={shell.openShare}
            onCollapse={toggleSidebar}
          />
        </motion.aside>
        <main className="relative min-w-0 flex-1">
          <Outlet />
        </main>
      </div>

      <CommandPalette
        open={palette}
        onClose={closePalette}
        onOpenTrash={shell.openTrash}
        onToggleSidebar={toggleSidebar}
      />
      <TrashDialog open={trash} onClose={closeTrash} />
      <ShareDialog open={share} onClose={closeShare} />
    </ShellContext.Provider>
  );
}
