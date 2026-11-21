import { useEffect, useRef, useState, type ReactNode } from 'react';
import type {
  DatabaseProperty,
  OptionColor,
  PageSummary,
  PropertyType,
  PropertyValue,
  SelectOption,
} from '@shared/types';
import { useWorkspace } from '../contexts/WorkspaceContext';
import {
  Calendar,
  CheckBox,
  CircleChevronDown,
  Hashtag,
  LinkChain,
  LinkOut,
  Person,
  Plus,
  Tag,
  TextAlignLeft,
  TrashCan,
} from '../lib/icons';
import { cn, colorFor } from '../lib/utils';
import { Avatar, MenuItem, MenuLabel, MenuSeparator, Popover } from './ui';

/** Database properties: the editors used by table cells, board cards and a row's property list. */

export const PROPERTY_TYPES: { type: PropertyType; label: string; icon: ReactNode }[] = [
  { type: 'text', label: 'Text', icon: <TextAlignLeft size={14} /> },
  { type: 'number', label: 'Number', icon: <Hashtag size={14} /> },
  { type: 'select', label: 'Select', icon: <CircleChevronDown size={14} /> },
  { type: 'multi_select', label: 'Multi-select', icon: <Tag size={14} /> },
  { type: 'date', label: 'Date', icon: <Calendar size={14} /> },
  { type: 'person', label: 'Person', icon: <Person size={14} /> },
  { type: 'checkbox', label: 'Checkbox', icon: <CheckBox size={14} /> },
  { type: 'url', label: 'URL', icon: <LinkChain size={14} /> },
];

export const propertyIcon = (type: PropertyType) =>
  PROPERTY_TYPES.find((t) => t.type === type)?.icon ?? null;

const COLORS: OptionColor[] = [
  'gray',
  'blue',
  'green',
  'yellow',
  'orange',
  'red',
  'purple',
  'pink',
  'brown',
];

const CHIP: Record<OptionColor, string> = {
  gray: 'bg-zinc-500/12 text-zinc-700 dark:bg-zinc-400/15 dark:text-zinc-300',
  brown: 'bg-amber-900/10 text-amber-900 dark:bg-amber-700/25 dark:text-amber-200',
  orange: 'bg-orange-500/14 text-orange-700 dark:text-orange-300',
  yellow: 'bg-yellow-400/25 text-yellow-800 dark:bg-yellow-400/15 dark:text-yellow-200',
  green: 'bg-emerald-500/14 text-emerald-700 dark:text-emerald-300',
  blue: 'bg-blue-500/14 text-blue-700 dark:text-blue-300',
  purple: 'bg-violet-500/14 text-violet-700 dark:text-violet-300',
  pink: 'bg-pink-500/14 text-pink-700 dark:text-pink-300',
  red: 'bg-red-500/14 text-red-700 dark:text-red-300',
};

export function OptionChip({ option }: { option: SelectOption }) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] max-w-full items-center truncate rounded-md px-1.5 text-[12.5px] font-medium',
        CHIP[option.color],
      )}
    >
      {option.name}
    </span>
  );
}

/** Short random id for new properties and options. */
export const newId = () => Math.random().toString(36).slice(2, 10);

const isEmpty = (v: PropertyValue | undefined) =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

/** Text of a value, for sorting. */
export function sortKey(
  prop: DatabaseProperty | undefined,
  value: PropertyValue | undefined,
  names: Map<string, string>,
) {
  if (isEmpty(value)) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return value ? Number(value) : 0;
  const ids = Array.isArray(value) ? value : [String(value)];
  if (prop?.type === 'select' || prop?.type === 'multi_select') {
    return ids.map((id) => prop.options?.find((o) => o.id === id)?.name ?? '').join(', ');
  }
  if (prop?.type === 'person') return ids.map((id) => names.get(id) ?? '').join(', ');
  return ids.join(', ');
}

interface EditorProps {
  db: PageSummary;
  prop: DatabaseProperty;
  row: PageSummary;
  canEdit: boolean;
}

/** Shows and edits one value. Inline for text, numbers, dates and checkboxes; menus for the rest. */
export function ValueEditor({ db, prop, row, canEdit }: EditorProps) {
  const ws = useWorkspace();
  const value = row.props?.[prop.id] ?? null;
  const set = (next: PropertyValue) => void ws.updatePage(row._id, { props: { [prop.id]: next } });

  switch (prop.type) {
    case 'checkbox':
      return (
        <label className="flex h-8 items-center px-2">
          <input
            type="checkbox"
            aria-label={prop.name}
            checked={value === true}
            disabled={!canEdit}
            onChange={() => set(value !== true)}
            className="size-4 accent-[var(--color-accent)]"
          />
        </label>
      );
    case 'date':
      return (
        <input
          type="date"
          required // empty → :invalid, which main.css uses to hide the mm/dd/yyyy placeholder
          aria-label={prop.name}
          value={typeof value === 'string' ? value : ''}
          disabled={!canEdit}
          onChange={(e) => set(e.target.value || null)}
          className="folium-date h-8 w-full bg-transparent px-2 text-[13.5px] text-body outline-none disabled:opacity-100"
        />
      );
    case 'select':
    case 'multi_select':
      return <SelectEditor db={db} prop={prop} row={row} canEdit={canEdit} />;
    case 'person':
      return <PersonEditor prop={prop} row={row} canEdit={canEdit} />;
    default:
      return <TextEditor prop={prop} value={value} canEdit={canEdit} onCommit={set} />;
  }
}

function TextEditor({
  prop,
  value,
  canEdit,
  onCommit,
}: {
  prop: DatabaseProperty;
  value: PropertyValue;
  canEdit: boolean;
  onCommit: (v: PropertyValue) => void;
}) {
  const shown = value === null || value === undefined ? '' : String(value);
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);

  const commit = () => {
    const text = draft.trim();
    if (text === shown) return;
    if (!text) return onCommit(null);
    if (prop.type === 'number') {
      const n = Number(text);
      return Number.isFinite(n) ? onCommit(n) : setDraft(shown);
    }
    if (prop.type === 'url' && !/^https?:\/\//.test(text)) return onCommit(`https://${text}`);
    onCommit(text);
  };

  return (
    <div className="group/cell relative flex h-8 items-center">
      <input
        aria-label={prop.name}
        value={draft}
        disabled={!canEdit}
        inputMode={prop.type === 'number' ? 'decimal' : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setDraft(shown);
            e.currentTarget.blur();
          }
        }}
        className={cn(
          'h-full w-full min-w-0 bg-transparent px-2 text-[13.5px] text-body outline-none placeholder:text-faint disabled:opacity-100',
          prop.type === 'number' && 'text-right tabular-nums',
          prop.type === 'url' && 'text-accent underline decoration-accent/30 underline-offset-2',
        )}
      />
      {prop.type === 'url' && shown && (
        <a
          href={shown}
          target="_blank"
          rel="noreferrer"
          aria-label="Open link"
          className="absolute right-1 grid size-6 place-items-center rounded-md bg-raised text-muted opacity-0 shadow-sm transition-opacity group-hover/cell:opacity-100"
        >
          <LinkOut size={12} />
        </a>
      )}
    </div>
  );
}

function SelectEditor({ db, prop, row, canEdit }: EditorProps) {
  const ws = useWorkspace();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const multi = prop.type === 'multi_select';
  const raw = row.props?.[prop.id];
  const chosen = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  const options = prop.options ?? [];
  const q = query.trim().toLowerCase();
  const matches = options.filter((o) => o.name.toLowerCase().includes(q));
  const exact = options.some((o) => o.name.toLowerCase() === q);

  const choose = (id: string) => {
    if (multi) {
      const next = chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id];
      void ws.updatePage(row._id, { props: { [prop.id]: next } });
    } else {
      void ws.updatePage(row._id, { props: { [prop.id]: chosen[0] === id ? null : id } });
      setOpen(false);
    }
    setQuery('');
  };

  // Typing a new name adds it as an option, then picks it.
  const create = async () => {
    const option: SelectOption = {
      id: newId(),
      name: query.trim(),
      color: COLORS[options.length % COLORS.length]!,
    };
    const properties = (db.properties ?? []).map((p) =>
      p.id === prop.id ? { ...p, options: [...options, option] } : p,
    );
    await ws.updatePage(db._id, { properties });
    choose(option.id);
  };

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label={prop.name}
        disabled={!canEdit}
        onClick={() => setOpen(true)}
        className="flex min-h-8 w-full flex-wrap items-center gap-1 px-2 py-1 text-left"
      >
        {chosen.map((id) => {
          const option = options.find((o) => o.id === id);
          return option ? <OptionChip key={id} option={option} /> : null;
        })}
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} className="w-[240px]">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (matches[0] && (exact || !q)) choose(matches[0].id);
            else if (q) void create();
          }}
          placeholder={options.length ? 'Search or add an option' : 'Type to add an option'}
          className="mb-1 h-8 w-full rounded-lg bg-hover px-2.5 text-[13px] text-strong outline-none placeholder:text-faint"
        />
        {matches.map((option) => (
          <MenuItem
            key={option.id}
            checked={chosen.includes(option.id)}
            onSelect={() => choose(option.id)}
          >
            <OptionChip option={option} />
          </MenuItem>
        ))}
        {q && !exact && (
          <MenuItem icon={<Plus size={13} />} onSelect={() => void create()}>
            Create “{query.trim()}”
          </MenuItem>
        )}
      </Popover>
    </>
  );
}

function PersonEditor({ prop, row, canEdit }: Omit<EditorProps, 'db'>) {
  const ws = useWorkspace();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const people = Array.isArray(row.props?.[prop.id]) ? (row.props[prop.id] as string[]) : [];
  const nameOf = (id: string) => ws.members.find((m) => m.user._id === id)?.user.name ?? 'Someone';
  const toggle = (id: string) => {
    const next = people.includes(id) ? people.filter((p) => p !== id) : [...people, id];
    void ws.updatePage(row._id, { props: { [prop.id]: next } });
  };

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label={prop.name}
        disabled={!canEdit}
        onClick={() => setOpen(true)}
        className="flex min-h-8 w-full flex-wrap items-center gap-x-2.5 gap-y-1 px-2 py-1 text-left text-[13px] text-body"
      >
        {people.map((id) => (
          <span key={id} className="flex items-center gap-1.5">
            <Avatar name={nameOf(id)} color={colorFor(id)} size={18} />
            {nameOf(id)}
          </span>
        ))}
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} className="w-[240px]">
        {ws.members.map((m) => (
          <MenuItem
            key={m.user._id}
            icon={<Avatar name={m.user.name} color={colorFor(m.user._id)} size={18} />}
            checked={people.includes(m.user._id)}
            onSelect={() => toggle(m.user._id)}
          >
            {m.user.name}
          </MenuItem>
        ))}
      </Popover>
    </>
  );
}

/** "+ Add a property": name it and pick a type. */
export function AddProperty({
  db,
  children,
  className,
  label,
}: {
  db: PageSummary;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const ws = useWorkspace();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const add = (type: PropertyType) => {
    const label = PROPERTY_TYPES.find((t) => t.type === type)!.label;
    const prop: DatabaseProperty = {
      id: newId(),
      name: name.trim() || label,
      type,
      ...((type === 'select' || type === 'multi_select') && { options: [] }),
    };
    void ws.updatePage(db._id, { properties: [...(db.properties ?? []), prop] });
    setOpen(false);
    setName('');
  };

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label={label}
        onClick={() => setOpen(true)}
        className={className}
      >
        {children}
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} className="w-[230px]">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add('text')}
          placeholder="Property name"
          aria-label="Property name"
          className="mb-1 h-8 w-full rounded-lg bg-hover px-2.5 text-[13px] text-strong outline-none placeholder:text-faint"
        />
        <MenuLabel>Type</MenuLabel>
        {PROPERTY_TYPES.map((t) => (
          <MenuItem key={t.type} icon={t.icon} onSelect={() => add(t.type)}>
            {t.label}
          </MenuItem>
        ))}
      </Popover>
    </>
  );
}

/** Rename or delete a property (and sort by it, in tables). */
export function PropertyMenu({
  db,
  prop,
  anchor,
  open,
  onClose,
  extra,
}: {
  db: PageSummary;
  prop: DatabaseProperty;
  anchor: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  extra?: ReactNode;
}) {
  const ws = useWorkspace();
  const [name, setName] = useState(prop.name);
  useEffect(() => setName(prop.name), [prop.name, open]);
  const save = (properties: DatabaseProperty[]) => void ws.updatePage(db._id, { properties });

  return (
    <Popover anchor={anchor} open={open} onClose={onClose} className="w-[230px]">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name.trim() && name.trim() !== prop.name) {
            save(
              (db.properties ?? []).map((p) =>
                p.id === prop.id ? { ...p, name: name.trim() } : p,
              ),
            );
          }
        }}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        aria-label="Property name"
        className="mb-1 h-8 w-full rounded-lg bg-hover px-2.5 text-[13px] text-strong outline-none"
      />
      {extra}
      <MenuSeparator />
      <MenuItem
        danger
        icon={<TrashCan size={14} />}
        onSelect={() => {
          onClose();
          save((db.properties ?? []).filter((p) => p.id !== prop.id));
        }}
      >
        Delete property
      </MenuItem>
    </Popover>
  );
}

/** A row page's properties, listed under its title. */
export function PropertyPanel({
  db,
  row,
  canEdit,
}: {
  db: PageSummary;
  row: PageSummary;
  canEdit: boolean;
}) {
  return (
    <div className="mb-4 border-b border-line pb-3 text-[13.5px]">
      {(db.properties ?? []).map((prop) => (
        <div key={prop.id} className="flex items-start gap-2">
          <span className="flex h-8 w-36 shrink-0 items-center gap-2 text-muted">
            <span className="text-faint">{propertyIcon(prop.type)}</span>
            <span className="truncate">{prop.name}</span>
          </span>
          <div className="hover-fill min-w-0 flex-1 rounded-md">
            <ValueEditor db={db} prop={prop} row={row} canEdit={canEdit} />
          </div>
        </div>
      ))}
      {canEdit && (
        <AddProperty
          db={db}
          className="hover-fill mt-1 flex h-8 items-center gap-2 rounded-md px-1 text-muted hover:text-strong"
        >
          <Plus size={14} /> Add a property
        </AddProperty>
      )}
    </div>
  );
}
