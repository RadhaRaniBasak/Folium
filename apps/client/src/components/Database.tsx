import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import type {
  DatabaseProperty,
  DatabaseView as View,
  PageSummary,
  PropertyValue,
} from '@shared/types';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { ArrowDown, ArrowUp, Dashboard, Enlarge, Grid, Plus, TextAlignLeft } from '../lib/icons';
import { cn, colorFor, pageTitle, spring } from '../lib/utils';
import {
  AddProperty,
  OptionChip,
  PropertyMenu,
  propertyIcon,
  sortKey,
  ValueEditor,
} from './Properties';
import { Avatar, Button, MenuItem, Popover } from './ui';

/** A database page: its rows as a table or a board, sharing one set of view settings. */
export function DatabaseView({ db, canEdit }: { db: PageSummary; canEdit: boolean }) {
  const ws = useWorkspace();
  const view: View = db.view ?? { type: 'table' };
  const rows = useMemo(
    () =>
      ws.pages
        .filter((p) => p.parent === db._id)
        .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt)),
    [ws.pages, db._id],
  );
  const [focusId, setFocusId] = useState<string | null>(null);

  const setView = (patch: Partial<View>) =>
    void ws.updatePage(db._id, { view: { ...view, ...patch } });
  const addRow = async (props?: Record<string, PropertyValue>) => {
    const row = await ws.createPage(db._id, { open: false, props });
    if (row) setFocusId(row._id);
  };

  return (
    <div className="px-[54px] pb-10">
      <div role="tablist" className="mb-1 flex items-center gap-1 border-b border-line">
        {(['table', 'board'] as const).map((type) => (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={view.type === type}
            disabled={!canEdit && view.type !== type}
            onClick={() => setView({ type })}
            className={cn(
              'relative flex items-center gap-1.5 px-2 pb-2 pt-1 text-[13px] font-medium transition-colors',
              view.type === type ? 'text-strong' : 'text-muted hover:text-dim',
            )}
          >
            {type === 'table' ? <Grid size={14} /> : <Dashboard size={14} />}
            {type === 'table' ? 'Table' : 'Board'}
            {view.type === type && (
              <motion.span
                layoutId={`db-tab-${db._id}`}
                transition={spring}
                className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-strong"
              />
            )}
          </button>
        ))}
        <span className="ml-auto text-[12px] text-faint">
          {rows.length} {rows.length === 1 ? 'row' : 'rows'}
        </span>
        {canEdit && (
          <Button
            variant="primary"
            className="mb-1.5 ml-2 h-7 px-2.5 text-[12.5px]"
            onClick={() => void addRow()}
          >
            <Plus size={13} /> New
          </Button>
        )}
      </div>
      {view.type === 'table' ? (
        <Table db={db} rows={rows} canEdit={canEdit} focusId={focusId} onAdd={addRow} />
      ) : (
        <Board db={db} rows={rows} canEdit={canEdit} onAdd={addRow} onView={setView} />
      )}
    </div>
  );
}

function Table({
  db,
  rows,
  canEdit,
  focusId,
  onAdd,
}: {
  db: PageSummary;
  rows: PageSummary[];
  canEdit: boolean;
  focusId: string | null;
  onAdd: () => void;
}) {
  const ws = useWorkspace();
  const properties = db.properties ?? [];
  const sort = db.view?.sort;
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const names = new Map(ws.members.map((m) => [m.user._id, m.user.name]));
    const prop = db.properties?.find((p) => p.id === sort.prop);
    const key = (row: PageSummary) =>
      sort.prop === 'title'
        ? pageTitle(row).toLowerCase()
        : sortKey(prop, row.props?.[sort.prop], names);
    return [...rows].sort((a, b) => {
      const [x, y] = [key(a), key(b)];
      const order =
        typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return sort.dir === 'desc' ? -order : order;
    });
  }, [rows, sort, db.properties, ws.members]);

  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <table className="w-full min-w-max border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            <HeaderCell db={db} canEdit={canEdit} />
            {properties.map((prop) => (
              <HeaderCell key={prop.id} db={db} prop={prop} canEdit={canEdit} />
            ))}
            {canEdit && (
              <th className="w-10 p-0">
                <AddProperty
                  db={db}
                  label="Add a property"
                  className="hover-fill grid size-8 place-items-center rounded-md text-muted hover:text-strong"
                >
                  <Plus size={14} />
                </AddProperty>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row._id} className="group border-b border-line">
              <td className="min-w-[220px] border-r border-line p-0">
                <NameCell row={row} canEdit={canEdit} autoFocus={row._id === focusId} />
              </td>
              {properties.map((prop) => (
                <td
                  key={prop.id}
                  className="min-w-[150px] max-w-[320px] border-r border-line p-0 align-top transition-colors hover:bg-hover/60"
                >
                  <ValueEditor db={db} prop={prop} row={row} canEdit={canEdit} />
                </td>
              ))}
              {canEdit && <td />}
            </tr>
          ))}
        </tbody>
      </table>
      {canEdit && (
        <button
          type="button"
          onClick={onAdd}
          className="hover-fill mt-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted hover:text-strong"
        >
          <Plus size={13} /> New
        </button>
      )}
    </div>
  );
}

/** Column header: rename / delete / sort. The Name column only sorts. */
function HeaderCell({
  db,
  prop,
  canEdit,
}: {
  db: PageSummary;
  prop?: DatabaseProperty;
  canEdit: boolean;
}) {
  const ws = useWorkspace();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const id = prop?.id ?? 'title';
  const sort = db.view?.sort;
  const sorted = sort?.prop === id ? sort.dir : null;

  const setSort = (dir: 'asc' | 'desc') => {
    setOpen(false);
    void ws.updatePage(db._id, {
      view: { ...(db.view ?? { type: 'table' }), sort: sorted === dir ? null : { prop: id, dir } },
    });
  };
  const sortItems = (
    <>
      <MenuItem
        icon={<ArrowUp size={14} />}
        checked={sorted === 'asc'}
        onSelect={() => setSort('asc')}
      >
        Sort ascending
      </MenuItem>
      <MenuItem
        icon={<ArrowDown size={14} />}
        checked={sorted === 'desc'}
        onSelect={() => setSort('desc')}
      >
        Sort descending
      </MenuItem>
    </>
  );

  return (
    <th
      className={cn(
        'border-r border-line p-0 font-normal',
        prop ? 'min-w-[150px]' : 'min-w-[220px]',
      )}
    >
      <button
        ref={anchor}
        type="button"
        disabled={!canEdit}
        onClick={() => setOpen(true)}
        className="hover-fill flex h-8 w-full items-center gap-1.5 px-2 text-[12.5px] text-muted disabled:hover:bg-transparent"
      >
        <span className="text-faint">
          {prop ? propertyIcon(prop.type) : <TextAlignLeft size={14} />}
        </span>
        <span className="truncate">{prop?.name ?? 'Name'}</span>
        {sorted === 'asc' && <ArrowUp size={12} />}
        {sorted === 'desc' && <ArrowDown size={12} />}
      </button>
      {prop ? (
        <PropertyMenu
          db={db}
          prop={prop}
          anchor={anchor}
          open={open}
          onClose={() => setOpen(false)}
          extra={sortItems}
        />
      ) : (
        <Popover anchor={anchor} open={open} onClose={() => setOpen(false)}>
          {sortItems}
        </Popover>
      )}
    </th>
  );
}

function NameCell({
  row,
  canEdit,
  autoFocus,
}: {
  row: PageSummary;
  canEdit: boolean;
  autoFocus: boolean;
}) {
  const ws = useWorkspace();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(row.title);
  useEffect(() => setDraft(row.title), [row.title]);
  const commit = () => {
    if (draft !== row.title) void ws.updatePage(row._id, { title: draft });
  };

  return (
    <div className="flex h-8 items-center gap-1.5 pl-2 pr-1">
      {row.icon && <span className="text-[14px]">{row.icon}</span>}
      <input
        aria-label="Name"
        value={draft}
        autoFocus={autoFocus}
        disabled={!canEdit}
        placeholder="Untitled"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] font-medium text-strong outline-none placeholder:text-faint disabled:opacity-100"
      />
      <button
        type="button"
        onClick={() => navigate(`/p/${row._id}`)}
        className="flex h-6 shrink-0 items-center gap-1 rounded-md border border-line bg-raised px-1.5 text-[11.5px] font-medium text-dim opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        <Enlarge size={11} /> Open
      </button>
    </div>
  );
}

function Board({
  db,
  rows,
  canEdit,
  onAdd,
  onView,
}: {
  db: PageSummary;
  rows: PageSummary[];
  canEdit: boolean;
  onAdd: (props?: Record<string, PropertyValue>) => void;
  onView: (patch: Partial<View>) => void;
}) {
  const ws = useWorkspace();
  const navigate = useNavigate();
  const [over, setOver] = useState<string | null>(null);
  const selects = (db.properties ?? []).filter((p) => p.type === 'select');
  const group = selects.find((p) => p.id === db.view?.groupBy) ?? selects[0];

  if (!group) {
    return (
      <p className="py-12 text-center text-[13px] text-muted">
        Add a Select property to group cards into columns.
      </p>
    );
  }

  const options = group.options ?? [];
  const valueOf = (row: PageSummary) => {
    const value = row.props?.[group.id];
    return typeof value === 'string' && options.some((o) => o.id === value) ? value : null;
  };
  const columns = [
    ...options.map((o) => ({ key: o.id, id: o.id as string | null, option: o })),
    { key: 'none', id: null, option: null },
  ];

  return (
    <>
      {selects.length > 1 && (
        <label className="mb-2 flex items-center gap-2 text-[12.5px] text-muted">
          Group by
          <select
            value={group.id}
            disabled={!canEdit}
            onChange={(e) => onView({ groupBy: e.target.value })}
            className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-[12.5px] text-body outline-none"
          >
            {selects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="-mx-2 flex gap-3 overflow-x-auto px-2 pb-4 pt-1">
        {columns.map((col) => {
          const cards = rows.filter((r) => valueOf(r) === col.id);
          return (
            <section
              key={col.key}
              aria-label={col.option?.name ?? `No ${group.name}`}
              onDragOver={(e) => {
                if (!canEdit || !e.dataTransfer.types.includes('text/folium-row')) return;
                e.preventDefault();
                setOver(col.key);
              }}
              onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData('text/folium-row');
                if (id) void ws.updatePage(id, { props: { [group.id]: col.id } });
              }}
              className={cn(
                'flex w-[264px] shrink-0 flex-col gap-1.5 rounded-xl p-1.5 transition-colors',
                over === col.key ? 'bg-accent/10 ring-1 ring-accent/30' : 'bg-hover/60',
              )}
            >
              <header className="flex items-center gap-2 px-1.5 py-1">
                {col.option ? (
                  <OptionChip option={col.option} />
                ) : (
                  <span className="text-[12.5px] font-medium text-muted">No {group.name}</span>
                )}
                <span className="text-[12px] tabular-nums text-faint">{cards.length}</span>
              </header>
              {cards.map((row) => (
                <div
                  key={row._id}
                  role="link"
                  tabIndex={0}
                  draggable={canEdit}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/folium-row', row._id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onClick={() => navigate(`/p/${row._id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/p/${row._id}`)}
                  className="cursor-pointer rounded-lg border border-line bg-raised p-2.5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <p className="text-[13.5px] font-medium text-strong">
                    {row.icon && <span className="mr-1">{row.icon}</span>}
                    {pageTitle(row)}
                  </p>
                  <CardValues db={db} row={row} skip={group.id} />
                </div>
              ))}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onAdd(col.id ? { [group.id]: col.id } : undefined)}
                  className="hover-fill flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] text-muted hover:text-strong"
                >
                  <Plus size={13} /> New
                </button>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

/** The other values on a board card, compact. */
function CardValues({ db, row, skip }: { db: PageSummary; row: PageSummary; skip: string }) {
  const ws = useWorkspace();
  const parts: ReactNode[] = [];
  for (const prop of db.properties ?? []) {
    const value = row.props?.[prop.id];
    if (
      prop.id === skip ||
      value === null ||
      value === undefined ||
      value === '' ||
      value === false
    )
      continue;
    const ids = Array.isArray(value) ? value : [String(value)];
    if (ids.length === 0) continue;
    if (prop.type === 'select' || prop.type === 'multi_select') {
      for (const id of ids) {
        const option = prop.options?.find((o) => o.id === id);
        if (option) parts.push(<OptionChip key={`${prop.id}-${id}`} option={option} />);
      }
    } else if (prop.type === 'person') {
      for (const id of ids) {
        const name = ws.members.find((m) => m.user._id === id)?.user.name ?? 'Someone';
        parts.push(<Avatar key={`${prop.id}-${id}`} name={name} color={colorFor(id)} size={20} />);
      }
    } else {
      const text =
        prop.type === 'date'
          ? new Date(`${value}T00:00`).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })
          : prop.type === 'checkbox'
            ? `✓ ${prop.name}`
            : String(value);
      parts.push(
        <span key={prop.id} className="truncate text-[12px] text-muted">
          {text}
        </span>,
      );
    }
  }
  return parts.length ? (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{parts}</div>
  ) : null;
}
