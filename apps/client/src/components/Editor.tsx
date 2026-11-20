import { useEffect } from 'react';
import type { BlockNoteEditor, PartialBlock } from '@blocknote/core';
import { withCollaboration } from '@blocknote/core/yjs';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView, type Theme } from '@blocknote/mantine';
import type { PageFont, User } from '@shared/types';
import { Pages } from '../lib/api';
import type { Collab } from '../lib/collab';
import { ALT, colorFor, MOD, SHIFT } from '../lib/utils';

export type FoliumEditor = BlockNoteEditor;

const SAVE_DELAY = 1200;

// Editor colours mirror the app tokens in main.css.
const lightTheme: Theme = {
  colors: {
    editor: { text: '#3f3f46', background: '#fcfcfc' },
    menu: { text: '#3f3f46', background: '#ffffff' },
    tooltip: { text: '#f4f4f5', background: '#18181b' },
    hovered: { text: '#18181b', background: '#f1f1f2' },
    selected: { text: '#fafafa', background: '#27272a' },
    disabled: { text: '#a1a1aa', background: '#f4f4f5' },
    shadow: '#e4e4e7',
    border: '#e4e4e7',
    sideMenu: '#a1a1aa',
  },
  borderRadius: 10,
};

const darkTheme: Theme = {
  colors: {
    editor: { text: '#d4d4d8', background: '#18181b' },
    menu: { text: '#d4d4d8', background: '#27272a' },
    tooltip: { text: '#f4f4f5', background: '#3f3f46' },
    hovered: { text: '#fafafa', background: '#3f3f46' },
    selected: { text: '#18181b', background: '#e4e4e7' },
    disabled: { text: '#71717a', background: '#27272a' },
    shadow: '#09090b',
    border: '#3f3f46',
    sideMenu: '#71717a',
  },
  borderRadius: 10,
};

function isEmpty(doc: FoliumEditor['document']): boolean {
  if (doc.length > 1) return false;
  const first = doc[0];
  return (
    !first ||
    (first.type === 'paragraph' && Array.isArray(first.content) && first.content.length === 0)
  );
}

export const WELCOME_BLOCKS: PartialBlock[] = [
  {
    type: 'paragraph',
    content:
      'Folium is a workspace for notes, docs and plans. Everything here syncs live to everyone on the page.',
  },
  { type: 'heading', props: { level: 2 }, content: 'Try these' },
  { type: 'checkListItem', content: 'Type / for headings, to-dos, toggles, tables, code and more' },
  { type: 'checkListItem', content: `Press ${MOD} K to search titles and page content` },
  {
    type: 'checkListItem',
    content: 'Drag pages in the sidebar to reorder them or nest one inside another',
  },
  { type: 'checkListItem', content: 'Select text to format it, add a link or change its colour' },
  { type: 'checkListItem', content: 'Invite a teammate from Share and watch their cursor appear' },
  { type: 'heading', props: { level: 2 }, content: 'Shortcuts' },
  {
    type: 'table',
    content: {
      type: 'tableContent',
      rows: [
        { cells: ['Search everything', `${MOD} K`] },
        { cells: ['New page', `${MOD} ${ALT} N`] },
        { cells: ['Toggle sidebar', `${MOD} \\`] },
        { cells: ['Dark mode', `${MOD} ${SHIFT} L`] },
      ],
    },
  },
  {
    type: 'toggleListItem',
    content: 'How does live sync work?',
    children: [
      {
        type: 'paragraph',
        content:
          'Each page is a Yjs document. Edits travel over Socket.io, merge without conflicts and are saved to MongoDB, so you can even keep typing offline.',
      },
    ],
  },
  {
    type: 'quote',
    content: 'Pages can live inside pages: hover one in the sidebar and press + to add a subpage.',
  },
];

interface Props {
  collab: Collab;
  user: User;
  canEdit: boolean;
  isDark: boolean;
  font: PageFont;
  seed?: 'welcome';
  /** Called once the seed has been applied (or skipped). */
  onSeeded?: () => void;
  onReady?: (editor: FoliumEditor | null) => void;
}

/** BlockNote bound to the page's Yjs document; mount once the provider has synced. */
export function Editor({ collab, user, canEdit, isDark, font, seed, onSeeded, onReady }: Props) {
  const { doc, provider } = collab;
  const pageId = provider.pageId;

  const editor = useCreateBlockNote(
    withCollaboration({
      collaboration: {
        provider,
        fragment: doc.getXmlFragment('document-store'),
        user: { name: user.name, color: colorFor(user.id) },
        showCursorLabels: 'activity',
      },
    }),
    [],
  );

  // First-run welcome content.
  useEffect(() => {
    if (seed !== 'welcome') return;
    if (canEdit && isEmpty(editor.document)) editor.replaceBlocks(editor.document, WELCOME_BLOCKS);
    onSeeded?.();
  }, [editor, seed, canEdit, onSeeded]);

  // Debounced snapshot → block records + search text. Remote edits are saved by their author.
  useEffect(() => {
    if (!canEdit) return;
    let timer: number | undefined;
    const save = () => {
      timer = undefined;
      void Pages.saveBlocks(pageId, editor.document).catch(() => {});
    };
    const unsubscribe = editor.onChange((_editor, { getChanges }) => {
      if (getChanges().every((change) => change.source.type === 'yjs-remote')) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(save, SAVE_DELAY);
    });
    return () => {
      unsubscribe?.();
      if (timer !== undefined) {
        window.clearTimeout(timer);
        save(); // flush when leaving the page
      }
    };
  }, [editor, pageId, canEdit]);

  useEffect(() => {
    onReady?.(editor);
    return () => onReady?.(null);
  }, [editor, onReady]);

  return (
    <div className="folium-editor" data-font={font}>
      <BlockNoteView editor={editor} editable={canEdit} theme={isDark ? darkTheme : lightTheme} />
    </div>
  );
}
