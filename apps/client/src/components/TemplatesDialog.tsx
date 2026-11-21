import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { Download } from '../lib/icons';
import { splitMarkdown, TEMPLATES, type Template } from '../lib/templates';
import { spring } from '../lib/utils';
import { useToast } from './Toaster';
import { Dialog, Spinner } from './ui';

/** New page from a template, or from a Markdown file. */
export function TemplatesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} label="Templates" className="max-w-[640px]">
      <Body onClose={onClose} />
    </Dialog>
  );
}

function Body({ onClose }: { onClose: () => void }) {
  const ws = useWorkspace();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const use = async (template: Template) => {
    setBusy(template.id);
    if (template.rows) {
      const db = await ws.createPage(null, {
        title: template.title,
        icon: template.icon,
        kind: 'database',
        open: false,
      });
      if (db) {
        for (const row of template.rows) {
          await ws.createPage(db._id, { title: row.title, props: row.props, open: false });
        }
        ws.openPage(db._id);
      }
    } else {
      await ws.createPage(null, {
        title: template.title,
        icon: template.icon,
        seed: { append: template.blocks },
      });
    }
    setBusy(null);
    onClose();
  };

  const importMarkdown = async (picked: File | undefined) => {
    if (!picked) return;
    if (picked.size > 2 * 1024 * 1024) return toast('Markdown files up to 2 MB', { tone: 'error' });
    const { title, body } = splitMarkdown(await picked.text(), picked.name);
    onClose();
    await ws.createPage(null, { title, seed: { markdown: body } });
    toast(`Imported “${title}”`);
  };

  return (
    <div>
      <div className="border-b border-line px-5 pb-4 pt-5">
        <h2 className="text-[15px] font-semibold text-strong">Start from a template</h2>
        <p className="mt-0.5 text-[12.5px] text-muted">Everything stays editable afterwards.</p>
      </div>
      <div className="grid gap-2 p-3 sm:grid-cols-2">
        {TEMPLATES.map((template, i) => (
          <motion.button
            key={template.id}
            type="button"
            disabled={!ws.canEdit || busy !== null}
            onClick={() => void use(template)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: i * 0.03 }}
            className="hover-fill flex items-start gap-3 rounded-xl border border-line p-3 text-left disabled:opacity-50"
          >
            <span className="text-[24px] leading-none">{template.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[13.5px] font-semibold text-strong">
                {template.name}
                {busy === template.id && <Spinner className="size-3.5" />}
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">
                {template.description}
              </span>
            </span>
          </motion.button>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-line px-5 py-3">
        <p className="text-[12.5px] text-muted">Have notes elsewhere?</p>
        <button
          type="button"
          disabled={!ws.canEdit}
          onClick={() => file.current?.click()}
          className="hover-fill flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-dim"
        >
          <Download size={13} className="rotate-180" /> Import Markdown
        </button>
        <input
          ref={file}
          type="file"
          accept=".md,.markdown,.txt,text/markdown,text/plain"
          aria-label="Markdown file"
          className="sr-only"
          onChange={(e) => {
            void importMarkdown(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
