import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react';
import { Check } from '../lib/icons';
import { cn, initials, spring } from '../lib/utils';

type Placement = 'bottom-start' | 'bottom-end' | 'bottom' | 'top' | 'right-start';

/** Positions a fixed, portaled element next to an anchor and keeps it on screen. */
function useFloating(
  anchor: RefObject<HTMLElement | null>,
  open: boolean,
  placement: Placement,
  offset = 6,
) {
  const floating = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ position: 'fixed', top: -9999, left: -9999 });

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      const f = floating.current?.getBoundingClientRect();
      if (!a || !f) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let top: number;
      let left: number;
      if (placement === 'right-start') {
        left = a.right + offset;
        if (left + f.width > vw - 8) left = a.left - offset - f.width;
        top = Math.min(a.top, vh - 8 - f.height);
      } else if (placement === 'top') {
        top = a.top - offset - f.height;
        if (top < 8) top = a.bottom + offset;
        left = a.left + a.width / 2 - f.width / 2;
      } else {
        top = a.bottom + offset;
        if (top + f.height > vh - 8) top = Math.max(8, a.top - offset - f.height);
        left =
          placement === 'bottom-end'
            ? a.right - f.width
            : placement === 'bottom'
              ? a.left + a.width / 2 - f.width / 2
              : a.left;
      }
      left = Math.min(Math.max(8, left), vw - f.width - 8);
      setStyle({ position: 'fixed', top, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, placement, anchor, offset]);

  return { floating, style };
}

export function Popover({
  anchor,
  open,
  onClose,
  placement = 'bottom-start',
  className,
  children,
}: {
  anchor: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  placement?: Placement;
  className?: string;
  children: ReactNode;
}) {
  const { floating, style } = useFloating(anchor, open, placement);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (floating.current?.contains(target) || anchor.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, onClose, anchor, floating]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={floating}
          style={style}
          initial={{ opacity: 0, scale: 0.96, y: placement === 'top' ? 4 : -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
          transition={spring}
          className={cn(
            'z-50 min-w-[210px] origin-top rounded-xl border border-line bg-raised p-1 shadow-float',
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function MenuItem({
  icon,
  children,
  hint,
  onSelect,
  danger,
  checked,
  disabled,
}: {
  icon?: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  checked?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'hover-fill flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium text-body disabled:pointer-events-none disabled:opacity-40',
        danger && 'text-red-600 dark:text-red-400',
      )}
    >
      {icon && (
        <span className={cn('grid size-4 place-items-center', danger ? '' : 'text-muted')}>
          {icon}
        </span>
      )}
      <span className="flex-1 truncate">{children}</span>
      {hint && <span className="text-[11.5px] text-faint">{hint}</span>}
      {checked && <Check size={14} className="text-strong" />}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="-mx-1 my-1 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wider text-faint">
      {children}
    </p>
  );
}

export function Dialog({
  open,
  onClose,
  children,
  className,
  align = 'center',
  label,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  align?: 'center' | 'top';
  label: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={cn(
            'fixed inset-0 z-40 flex justify-center bg-zinc-950/20 px-4 backdrop-blur-[2px] dark:bg-black/50',
            align === 'top' ? 'items-start pt-[12vh]' : 'items-center',
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4, transition: { duration: 0.12 } }}
            transition={spring}
            className={cn(
              'w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-raised shadow-dialog',
              className,
            )}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Kbd({ keys, className }: { keys: string[]; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {keys.map((key) => (
        <kbd
          key={key}
          className="min-w-[18px] rounded-[5px] border border-line bg-surface px-1 text-center font-sans text-[10.5px] font-medium leading-[16px] text-muted"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

/** Hover/focus tooltip with an optional keyboard shortcut. */
export function Tooltip({
  label,
  keys,
  placement = 'bottom',
  children,
}: {
  label: string;
  keys?: string[];
  placement?: Placement;
  children: ReactNode;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const { floating, style } = useFloating(anchor, open, placement);

  const show = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), 380);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setOpen(false);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <span
      ref={anchor}
      className="inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onMouseDown={hide}
    >
      {children}
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={floating}
              style={style}
              role="tooltip"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
              transition={spring}
              className="pointer-events-none z-[60] flex items-center gap-2 rounded-lg bg-zinc-900 px-2 py-1 text-[12px] font-medium text-zinc-100 shadow-float dark:bg-zinc-700"
            >
              {label}
              {keys && (
                <span className="flex gap-0.5 text-zinc-400 dark:text-zinc-300">
                  {keys.map((k) => (
                    <span key={k}>{k}</span>
                  ))}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </span>
  );
}

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function IconButton({ className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'hover-fill grid size-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:text-strong disabled:pointer-events-none disabled:opacity-40',
          className,
        )}
        {...props}
      />
    );
  },
);

type ButtonProps = HTMLMotionProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', className, ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type="button"
      whileTap={{ scale: 0.97 }}
      transition={spring}
      className={cn(
        'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-[background,opacity,color] disabled:pointer-events-none disabled:opacity-50',
        variant === 'primary' && 'bg-inverse text-on-inverse hover:opacity-90',
        variant === 'secondary' && 'border border-line bg-raised text-strong hover:bg-hover',
        variant === 'ghost' && 'hover-fill text-dim hover:text-strong',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-500',
        className,
      )}
      {...props}
    />
  );
});

export function Avatar({
  name,
  color,
  size = 24,
  className,
}: {
  name: string;
  color: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      title={name}
      className={cn(
        'grid shrink-0 select-none place-items-center rounded-full font-semibold text-white',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4), background: color }}
    >
      {initials(name)}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-hover', className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block size-4 animate-spin rounded-full border-2 border-line border-t-muted',
        className,
      )}
      aria-label="Loading"
    />
  );
}
