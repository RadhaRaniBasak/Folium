import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { EyeOpen, EyeSlashed } from '../lib/icons';
import { spring } from '../lib/utils';

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-surface px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-280px] h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(16_185_129/0.16),transparent)]" />
        <div className="grain absolute inset-0" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="relative w-full max-w-[380px]"
      >
        <div className="mb-7 flex flex-col items-center text-center">
          <motion.div
            initial={{ rotate: -12, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.05 }}
            className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-[24px] shadow-float"
          >
            🌿
          </motion.div>
          <h1 className="mt-5 text-[22px] font-semibold tracking-tight text-strong">{title}</h1>
          <p className="mt-1 text-[14px] text-muted">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-line bg-raised p-6 shadow-dialog">{children}</div>
        <p className="mt-6 text-center text-[13px] text-muted">{footer}</p>
      </motion.div>
    </div>
  );
}

export function Field({
  label,
  type,
  ...input
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-[12.5px] font-medium text-dim">{label}</span>
      <span className="flex items-center rounded-lg border border-line bg-surface transition-colors focus-within:border-accent/60 focus-within:ring-4 focus-within:ring-accent/10">
        <input
          type={isPassword && visible ? 'text' : type}
          className="h-10 w-full bg-transparent px-3 text-[14px] text-strong outline-none placeholder:text-faint"
          {...input}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="mr-1 grid size-8 place-items-center rounded-md text-faint hover:text-dim"
          >
            {visible ? <EyeSlashed size={15} /> : <EyeOpen size={15} />}
          </button>
        )}
      </span>
    </label>
  );
}

/** Error message that shakes in, so a failed attempt is noticed. */
export function FormError({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          key={message}
          role="alert"
          initial={{ opacity: 0, x: 0 }}
          animate={{ opacity: 1, x: [0, -6, 6, -4, 4, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-[13px] font-medium text-red-600 dark:text-red-400"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
