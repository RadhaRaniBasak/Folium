import type {
  DatabaseProperty,
  DatabaseView,
  OptionColor,
  PropertyType,
  PropertyValue,
  SelectOption,
} from '@repo/shared';
import { AppError } from '../../errors/AppError';

/** Validation for database properties, views and row values (all client-supplied). */

const TYPES = new Set<PropertyType>([
  'text',
  'number',
  'select',
  'multi_select',
  'date',
  'person',
  'checkbox',
  'url',
]);
const COLORS = new Set<OptionColor>([
  'gray',
  'brown',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'red',
]);
const ID = /^[A-Za-z0-9_-]{1,40}$/;

const bad = (message: string) => new AppError(message, 400);
const isName = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= 60;

/** What a new database starts with: a task tracker. */
export function defaultProperties(): DatabaseProperty[] {
  return [
    {
      id: 'status',
      name: 'Status',
      type: 'select',
      options: [
        { id: 'todo', name: 'Not started', color: 'gray' },
        { id: 'doing', name: 'In progress', color: 'blue' },
        { id: 'done', name: 'Done', color: 'green' },
      ],
    },
    { id: 'assignee', name: 'Assignee', type: 'person' },
    { id: 'due', name: 'Due', type: 'date' },
  ];
}

export function cleanProperties(value: unknown): DatabaseProperty[] {
  if (!Array.isArray(value) || value.length > 50) throw bad('properties must be a list (max 50)');
  const ids = new Set<string>();
  return value.map((raw: Record<string, unknown>) => {
    const { id, name, type, options } = raw ?? {};
    if (typeof id !== 'string' || !ID.test(id) || ids.has(id)) throw bad('Invalid property id');
    if (!isName(name)) throw bad('Property names are 1–60 characters');
    if (!TYPES.has(type as PropertyType)) throw bad(`Unknown property type: ${String(type)}`);
    ids.add(id);
    const prop: DatabaseProperty = { id, name: name.trim(), type: type as PropertyType };
    if (type === 'select' || type === 'multi_select') prop.options = cleanOptions(options);
    return prop;
  });
}

function cleanOptions(value: unknown): SelectOption[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) throw bad('options must be a list (max 100)');
  const ids = new Set<string>();
  return value.map((raw: Record<string, unknown>) => {
    const { id, name, color } = raw ?? {};
    if (typeof id !== 'string' || !ID.test(id) || ids.has(id)) throw bad('Invalid option id');
    if (!isName(name)) throw bad('Option names are 1–60 characters');
    ids.add(id);
    return {
      id,
      name: name.trim(),
      color: COLORS.has(color as OptionColor) ? (color as OptionColor) : 'gray',
    };
  });
}

export function cleanView(value: unknown, properties: DatabaseProperty[]): DatabaseView {
  const { type, groupBy, sort } = (value ?? {}) as Record<string, unknown>;
  if (type !== 'table' && type !== 'board') throw bad('view.type must be table or board');
  const view: DatabaseView = { type };
  if (
    typeof groupBy === 'string' &&
    properties.some((p) => p.id === groupBy && p.type === 'select')
  ) {
    view.groupBy = groupBy;
  }
  const s = sort as { prop?: unknown; dir?: unknown } | null | undefined;
  if (
    s &&
    typeof s.prop === 'string' &&
    (s.prop === 'title' || properties.some((p) => p.id === s.prop))
  ) {
    view.sort = { prop: s.prop, dir: s.dir === 'desc' ? 'desc' : 'asc' };
  }
  return view;
}

/**
 * Checks a partial update of a row's values against the database's properties. Null clears a
 * value. Returns the cleaned values and the people newly added to person properties.
 */
export function cleanValues(
  patch: unknown,
  properties: DatabaseProperty[],
  current: Record<string, PropertyValue>,
  members: Set<string>,
): { values: Record<string, PropertyValue>; added: string[] } {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch))
    throw bad('props must be an object');
  const values: Record<string, PropertyValue> = {};
  const added: string[] = [];
  for (const [id, value] of Object.entries(patch)) {
    const prop = properties.find((p) => p.id === id);
    if (!prop) throw bad(`Unknown property: ${id}`);
    if (value === null) {
      values[id] = null;
      continue;
    }
    const options = new Set(prop.options?.map((o) => o.id));
    const list = (check: (v: unknown) => boolean) => {
      if (!Array.isArray(value) || value.length > 50 || !value.every(check)) {
        throw bad(`${prop.name}: invalid value`);
      }
      return [...new Set(value as string[])];
    };
    switch (prop.type) {
      case 'text':
      case 'url':
        if (typeof value !== 'string' || value.length > 2000)
          throw bad(`${prop.name}: text up to 2000 characters`);
        if (prop.type === 'url' && value && !/^https?:\/\/\S+$/.test(value))
          throw bad(`${prop.name}: an http(s) link`);
        values[id] = value;
        break;
      case 'number':
        if (typeof value !== 'number' || !Number.isFinite(value))
          throw bad(`${prop.name}: a number`);
        values[id] = value;
        break;
      case 'checkbox':
        if (typeof value !== 'boolean') throw bad(`${prop.name}: true or false`);
        values[id] = value;
        break;
      case 'date':
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
          throw bad(`${prop.name}: a YYYY-MM-DD date`);
        values[id] = value;
        break;
      case 'select':
        if (typeof value !== 'string' || !options.has(value))
          throw bad(`${prop.name}: not one of its options`);
        values[id] = value;
        break;
      case 'multi_select':
        values[id] = list((v) => typeof v === 'string' && options.has(v));
        break;
      case 'person': {
        const people = list((v) => typeof v === 'string' && members.has(v));
        const before = new Set(Array.isArray(current[id]) ? (current[id] as string[]) : []);
        added.push(...people.filter((p) => !before.has(p)));
        values[id] = people;
        break;
      }
    }
  }
  return { values, added: [...new Set(added)] };
}
