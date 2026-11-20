import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '../lib/utils';

interface Toast {
  id: number;
  message: string;
  tone: 'default' | 'error';
  action?: { label: string; onClick: () => void };
}

type ShowToast = (
  message: string,
  options?: { tone?: Toast['tone']; action?: Toast['action'] },
) => void;

const ToastContext = createContext<ShowToast | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback(
    (id: number) => setToasts((all) => all.filter((t) => t.id !== id)),
    [],
  );

  const show = useCallback<ShowToast>(
    (message, options) => {
      const id = nextId.current++;
      setToasts((all) => [
        ...all.slice(-2),
        { id, message, tone: options?.tone ?? 'default', action: options?.action },
      ]);
      window.setTimeout(() => dismiss(id), options?.action ? 6000 : 3200);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex flex-col items-center gap-2">
          <AnimatePresence initial={false}>
            {toasts.map((toast) => (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.15 } }}
                transition={spring}
                role="status"
                className="pointer-events-auto flex items-center gap-3 rounded-xl bg-zinc-900 py-2 pl-3.5 pr-2 text-[13px] font-medium text-zinc-100 shadow-dialog dark:bg-zinc-800"
              >
                <span className={toast.tone === 'error' ? 'text-red-300' : undefined}>
                  {toast.message}
                </span>
                {toast.action ? (
                  <button
                    type="button"
                    className="rounded-md px-2 py-0.5 text-[12.5px] font-semibold text-white hover:bg-white/10"
                    onClick={() => {
                      toast.action?.onClick();
                      dismiss(toast.id);
                    }}
                  >
                    {toast.action.label}
                  </button>
                ) : (
                  <span className="w-1.5" />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
