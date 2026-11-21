import { RRule, type Options } from 'rrule';

/**
 * Times for reminders. RRULEs are evaluated on "floating" wall-clock time (a Date whose UTC fields
 * are the time on the user's clock), then converted to a real instant in their time zone. That
 * keeps "every 1st at 9am" at 9am across DST changes and whatever zone the server runs in.
 */

/** How far `tz` is ahead of UTC at `instant`, in ms (+05:30 → 19 800 000). */
export function tzOffset(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(instant);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'));
  return wall - Math.floor(instant.getTime() / 1000) * 1000;
}

export const toWall = (instant: Date, tz: string) =>
  new Date(instant.getTime() + tzOffset(instant, tz));

/** Inverse of toWall. A time skipped by DST resolves to the hour after. */
export function fromWall(wall: Date, tz: string): Date {
  const guess = wall.getTime() - tzOffset(wall, tz);
  return new Date(wall.getTime() - tzOffset(new Date(guess), tz));
}

export function isTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const FREQS = new Set([RRule.DAILY, RRule.WEEKLY, RRule.MONTHLY, RRule.YEARLY]);
const KEYS = new Set(['FREQ', 'INTERVAL', 'BYDAY', 'BYMONTHDAY', 'BYMONTH', 'BYHOUR', 'BYMINUTE']);

/**
 * Parses an RRULE body, allowing at most one reminder a day: daily or slower, one time of day.
 * Returns null for anything else so a bad chip can't spam anyone.
 */
export function parseRule(rrule: string): Partial<Options> | null {
  if (rrule.length > 200 || !/^[A-Z]+=[A-Z0-9,+-]+(;[A-Z]+=[A-Z0-9,+-]+)*$/.test(rrule))
    return null;
  if (!rrule.split(';').every((part) => KEYS.has(part.split('=')[0]!))) return null;
  const options = RRule.parseString(rrule);
  if (options.freq === undefined || !FREQS.has(options.freq)) return null;
  const single = (v: unknown) => v === undefined || typeof v === 'number';
  if (!single(options.byhour) || !single(options.byminute)) return null;
  if ((options.interval ?? 1) < 1 || (options.interval ?? 1) > 365) return null;
  return options;
}

interface Schedule {
  at: Date | null;
  rrule: string | null;
  tz: string;
  /** Start of the series, so "every 2 weeks" counts from when it was set. */
  anchor: Date;
}

/** The first time after `after` the reminder should go off, or null when it's done. */
export function nextRun({ at, rrule, tz, anchor }: Schedule, after: Date): Date | null {
  if (!rrule) return at && at.getTime() > after.getTime() ? at : null;
  const options = parseRule(rrule);
  if (!options) return null;
  const rule = new RRule({
    ...options,
    bysecond: 0,
    dtstart: new Date(Math.floor(toWall(anchor, tz).getTime() / 60000) * 60000),
  });
  const next = rule.after(toWall(after, tz));
  return next ? fromWall(next, tz) : null;
}
