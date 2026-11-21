import { useState } from 'react';
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  filterSuggestionItems,
  insertOrUpdateBlockForSlashMenu,
} from '@blocknote/core';
import {
  createReactBlockSpec,
  createReactInlineContentSpec,
  getDefaultReactSlashMenuItems,
  type DefaultReactSuggestionItem,
} from '@blocknote/react';
import type { MentionProps, PageSummary, ReminderProps, WorkspaceMember } from '@shared/types';
import { useMaybeAuth } from '../contexts/AuthContext';
import { useMaybeWorkspace } from '../contexts/WorkspaceContext';
import { Alarm, Enlarge, File, LinkOut } from '../lib/icons';
import {
  describeReminder,
  localTimeZone,
  looksLikeReminder,
  parseReminder,
  type ReminderSchedule,
} from '../lib/reminders';
import { cn, colorFor, pageTitle } from '../lib/utils';
import { PageIcon } from './Sidebar';
import { Avatar } from './ui';

/** Current name of the mentioned person or page, falling back to the saved label. */
function useMentionName({ kind, id, label }: MentionProps) {
  const ws = useMaybeWorkspace();
  if (kind === 'page') {
    const page = ws?.pagesById.get(id);
    return { name: page ? pageTitle(page) : label, page, missing: Boolean(ws && !page) };
  }
  const member = ws?.members.find((m) => m.user._id === id);
  return { name: member?.user.name ?? label, page: undefined, missing: false };
}

function MentionView(props: MentionProps) {
  const ws = useMaybeWorkspace();
  const me = useMaybeAuth()?.user?.id;
  const { name, page, missing } = useMentionName(props);

  if (props.kind === 'page') {
    return (
      <a
        href={`/p/${props.id}`}
        data-mention="page"
        className={cn('mention mention-page', missing && 'mention-missing')}
        onClick={(e) => {
          if (!ws || e.metaKey || e.ctrlKey) return;
          e.preventDefault();
          ws.openPage(props.id);
        }}
      >
        <span className="mention-icon">{page?.icon ?? <File size="0.95em" />}</span>
        {name}
      </a>
    );
  }
  return (
    <span
      data-mention="user"
      className={cn('mention mention-user', props.id === me && 'mention-me')}
    >
      @{name}
    </span>
  );
}

/** Plain version for copy, Markdown export and other apps. */
function MentionText(props: MentionProps) {
  const { name } = useMentionName(props);
  return props.kind === 'page' ? (
    <a href={`${location.origin}/p/${props.id}`}>{name}</a>
  ) : (
    <span>@{name}</span>
  );
}

const Mention = createReactInlineContentSpec(
  {
    type: 'mention',
    propSchema: {
      kind: { default: 'user', values: ['user', 'page'] },
      id: { default: '' },
      label: { default: '' },
    },
    content: 'none',
  },
  {
    render: ({ inlineContent }) => <MentionView {...(inlineContent.props as MentionProps)} />,
    toExternalHTML: ({ inlineContent }) => (
      <MentionText {...(inlineContent.props as MentionProps)} />
    ),
  },
);

function ReminderView(props: ReminderProps) {
  const overdue = !props.rrule && Boolean(props.at) && new Date(props.at).getTime() < Date.now();
  return (
    <span
      data-reminder
      className={cn('reminder-chip', overdue && 'reminder-overdue')}
      title={props.rrule ? 'Repeating reminder' : 'Reminder'}
    >
      <Alarm size="0.95em" />
      {describeReminder(props)}
    </span>
  );
}

/** A reminder inside a block: the block's text is what you're reminded about. */
const Reminder = createReactInlineContentSpec(
  {
    type: 'reminder',
    propSchema: {
      at: { default: '' },
      rrule: { default: '' },
      tz: { default: '' },
      owner: { default: '' },
    },
    content: 'none',
  },
  {
    render: ({ inlineContent }) => <ReminderView {...(inlineContent.props as ReminderProps)} />,
    toExternalHTML: ({ inlineContent }) => (
      <span>⏰ {describeReminder(inlineContent.props as ReminderProps)}</span>
    ),
  },
);

/**
 * The iframe URL for a link: provider players for YouTube, Vimeo, Loom, Figma, Spotify and
 * CodePen, the link itself otherwise. Only https, and never this app (a same-origin iframe could
 * reach into the page).
 */
export function embedUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.host === location.host) return null;
  const host = url.hostname.replace(/^(www|m)\./, '');
  const id = url.pathname.split('/').filter(Boolean);
  if (host === 'youtube.com') {
    const video = url.searchParams.get('v') ?? (id[0] === 'shorts' ? id[1] : null);
    if (video) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video)}`;
  }
  if (host === 'youtu.be' && id[0])
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id[0])}`;
  if (host === 'vimeo.com' && id[0])
    return `https://player.vimeo.com/video/${encodeURIComponent(id[0])}`;
  if (host === 'loom.com' && id[0] === 'share')
    return `https://www.loom.com/embed/${encodeURIComponent(id[1] ?? '')}`;
  if (host === 'figma.com')
    return `https://www.figma.com/embed?embed_host=folium&url=${encodeURIComponent(url.href)}`;
  if (host === 'open.spotify.com' && id[0] !== 'embed')
    return `https://open.spotify.com/embed/${id.join('/')}`;
  if (host === 'codepen.io' && id[1] === 'pen')
    return `https://codepen.io/${id[0]}/embed/${id[2] ?? ''}`;
  return url.href;
}

function EmbedView({
  url,
  editable,
  onSet,
}: {
  url: string;
  editable: boolean;
  onSet: (url: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(false);
  if (!url) {
    if (!editable) return null;
    return (
      <form
        contentEditable={false}
        onSubmit={(e) => {
          e.preventDefault();
          if (embedUrl(draft)) onSet(draft.trim());
          else setError(true);
        }}
        className="folium-embed-form"
      >
        <Enlarge size={15} />
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(false);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Paste a link to embed: YouTube, Loom, Figma, Spotify…"
          aria-label="Link to embed"
          aria-invalid={error}
        />
        <button type="submit">Embed</button>
      </form>
    );
  }
  const src = embedUrl(url);
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  })();
  return (
    <figure contentEditable={false} className="folium-embed">
      {src ? (
        <iframe
          src={src}
          title={`Embedded from ${host}`}
          className={host === 'open.spotify.com' ? 'h-[232px]' : 'aspect-video'}
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation allow-forms"
          allow="fullscreen; picture-in-picture; clipboard-write; encrypted-media; autoplay"
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
        />
      ) : (
        <p className="p-4 text-[13px] text-muted">This link can’t be embedded.</p>
      )}
      <figcaption>
        <a href={url} target="_blank" rel="noreferrer">
          {host} <LinkOut size={11} />
        </a>
      </figcaption>
    </figure>
  );
}

/** A web page or player, from a pasted link. */
const Embed = createReactBlockSpec(
  { type: 'embed', propSchema: { url: { default: '' } }, content: 'none' },
  {
    render: ({ block, editor }) => (
      <EmbedView
        url={block.props.url}
        editable={editor.isEditable}
        onSet={(url) => editor.updateBlock(block, { props: { url } })}
      />
    ),
    toExternalHTML: ({ block }) => <a href={block.props.url}>{block.props.url}</a>,
  },
);

export const schema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, embed: Embed() },
  inlineContentSpecs: { ...defaultInlineContentSpecs, mention: Mention, reminder: Reminder },
});

/** BlockNote's slash menu plus Embed. */
export function slashItems(editor: FoliumEditor, query: string): DefaultReactSuggestionItem[] {
  const items = getDefaultReactSlashMenuItems(editor);
  // In File's group, just before it: File's aliases include "embed" too, so /embed picks this.
  const at = Math.max(
    0,
    items.findIndex((item) => 'key' in item && item.key === 'file'),
  );
  items.splice(at, 0, {
    title: 'Embed',
    subtext: 'YouTube, Loom, Figma, Spotify, CodePen or any https page',
    aliases: ['embed', 'iframe', 'youtube', 'loom', 'figma', 'spotify'],
    group: items[at]?.group,
    icon: <Enlarge size={18} />,
    onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: 'embed' }),
  });
  return filterSuggestionItems(items, query);
}

export type FoliumEditor = typeof schema.BlockNoteEditor;

/** Tomorrow at 9am, for "remind me" with no time yet. */
function tomorrowMorning(): ReminderSchedule {
  const at = new Date();
  at.setDate(at.getDate() + 1);
  at.setHours(9, 0, 0, 0);
  return { at: at.toISOString(), rrule: '', tz: localTimeZone() };
}

/**
 * Items for the `@` menu: people, pages to link, and reminders read from plain English
 * ("@every 1st at 9am"). A parsed reminder goes first; while a time is still being typed a
 * "remind me" item keeps the menu open.
 */
export function mentionItems(
  editor: FoliumEditor,
  query: string,
  {
    members,
    pages,
    pageId,
    userId,
  }: { members: WorkspaceMember[]; pages: PageSummary[]; pageId: string; userId: string },
): DefaultReactSuggestionItem[] {
  const insert = (props: MentionProps) =>
    editor.insertInlineContent([{ type: 'mention', props }, ' ']);
  const remind = (schedule: ReminderSchedule, text = '') =>
    editor.insertInlineContent([
      ...(text ? [`${text} `] : []),
      { type: 'reminder', props: { ...schedule, owner: userId } },
      ' ',
    ]);

  const people = members.map((m) => ({
    title: m.user.name,
    subtext: m.user.email,
    aliases: [m.user.email],
    group: 'People',
    icon: <Avatar name={m.user.name} color={colorFor(m.user._id)} size={20} />,
    onItemClick: () => insert({ kind: 'user', id: m.user._id, label: m.user.name }),
  }));
  const links = pages
    .filter((p) => p._id !== pageId)
    .map((p) => ({
      title: pageTitle(p),
      group: 'Link to page',
      icon: <PageIcon page={p} size={14} />,
      onItemClick: () => insert({ kind: 'page', id: p._id, label: pageTitle(p) }),
    }));

  const found = [
    ...filterSuggestionItems(people, query).slice(0, 5),
    ...filterSuggestionItems(links, query).slice(0, 6),
  ];

  const parsed = query.trim() ? parseReminder(query) : null;
  if (parsed) {
    const { text, ...schedule } = parsed;
    return [
      {
        title: describeReminder(schedule),
        subtext: text ? `Remind me to ${text}` : 'Remind me',
        group: 'Remind',
        icon: <Alarm size={16} />,
        onItemClick: () => remind(schedule, text),
      },
      ...found,
    ];
  }
  if (!looksLikeReminder(query)) return found;
  const fallback = tomorrowMorning();
  return [
    ...found,
    {
      title: `Remind me ${describeReminder(fallback).replace(/^\w/, (c) => c.toLowerCase())}`,
      subtext: 'or keep typing: “tomorrow 5pm”, “every 1st at 9am”',
      group: 'Remind',
      icon: <Alarm size={16} />,
      onItemClick: () => remind(fallback),
    },
  ];
}
