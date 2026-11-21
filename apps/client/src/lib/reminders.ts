import { casual } from 'chrono-node';
import type { ReminderProps } from '@shared/types';
import { DAY_NAMES, DAYS, localTimeZone, MONTHS } from './reminderText';

export { describeReminder, describeRule, describeTime, localTimeZone } from './reminderText';

/**
 * Plain-English reminders: "pay rent every 1st at 9am" → a monthly RRULE at 9:00 in the user's
 * time zone, plus the leftover text ("pay rent"). chrono-node reads the dates and times; the
 * repeat phrases ("every …", "daily") are matched here and turned into RRULE parts.
 */

export type ReminderSchedule = Omit<ReminderProps, 'owner'>;

export interface ParsedReminder extends ReminderSchedule {
  /** What's left once the time words are taken out: the task. */
  text: string;
}

const DAY = '(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|sday|urday)?s?\\b';
const ORDINAL = '(\\d{1,2})(?:st|nd|rd|th)';

const dayCode = (word: string) =>
  DAYS[DAY_NAMES.findIndex((d) => d.startsWith(word.slice(0, 3).toLowerCase()))]!;

interface Repeat {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval?: number;
  byday?: string[];
  bymonthday?: number;
  /** Yearly: month and day come from the date chrono finds. */
  yearly?: boolean;
}

/** Each pattern takes a match and returns the repeat it describes. Longest phrases first. */
const REPEATS: [RegExp, (m: RegExpMatchArray, now: Date) => Repeat][] = [
  [/\bevery\s+weekday\b|\bon\s+weekdays\b/i, () => ({ freq: 'WEEKLY', byday: DAYS.slice(1, 6) })],
  [/\bevery\s+weekend\b|\bon\s+weekends\b/i, () => ({ freq: 'WEEKLY', byday: ['SA', 'SU'] })],
  [
    new RegExp(`\\bevery\\s+(other\\s+)?${DAY}((?:\\s*(?:,|and|&)\\s*${DAY})*)`, 'i'),
    (m) => ({
      freq: 'WEEKLY',
      interval: m[1] ? 2 : 1,
      byday: [m[2]!, ...(m[3]!.match(new RegExp(DAY, 'gi')) ?? [])].map(dayCode),
    }),
  ],
  [
    new RegExp(
      `\\b(?:every\\s+month\\s+on\\s+the\\s+${ORDINAL}|(?:on\\s+)?(?:the\\s+)?${ORDINAL}\\s+of\\s+(?:every|each|the)\\s+month|every\\s+${ORDINAL}(?:\\s+of\\s+(?:the|each|every)\\s+month)?)`,
      'i',
    ),
    (m) => ({ freq: 'MONTHLY', bymonthday: Number(m[1] ?? m[2] ?? m[3]) }),
  ],
  [
    /\bevery\s+(?:month\s+on\s+the\s+)?last\s+day(?:\s+of\s+(?:the|each|every)\s+month)?/i,
    () => ({ freq: 'MONTHLY', bymonthday: -1 }),
  ],
  [
    /\bevery\s+(\d+)\s+(day|week|month|year)s\b/i,
    (m, now) => ({ ...unitRepeat(m[2]!.toLowerCase(), now), interval: Number(m[1]) }),
  ],
  [
    /\bevery\s+(other\s+)?(day|week|month|year)\b/i,
    (m, now) => ({ ...unitRepeat(m[2]!.toLowerCase(), now), interval: m[1] ? 2 : 1 }),
  ],
  [/\b(daily|weekly|monthly|yearly|annually)\b/i, (m, now) => unitRepeat(m[1]!.toLowerCase(), now)],
];

function unitRepeat(unit: string, now: Date): Repeat {
  if (unit.startsWith('d')) return { freq: 'DAILY' };
  if (unit.startsWith('w')) return { freq: 'WEEKLY', byday: [DAYS[now.getDay()]!] };
  if (unit.startsWith('m')) return { freq: 'MONTHLY', bymonthday: now.getDate() };
  return { freq: 'YEARLY', yearly: true };
}

/** Removes `part` from `text`, leaving single spaces. */
const cut = (text: string, index: number, length: number) =>
  `${text.slice(0, index)} ${text.slice(index + length)}`;

function cleanText(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/^\s*(remind\s+me\s+(to\s+)?|remind\s+)/i, '')
    .replace(/\s+(at|on|by|from|every|in|,|-)\s*$/i, '')
    .replace(/^\s*(at|on|by|,|-)\s+/i, '')
    .trim();
}

/**
 * Reads a reminder out of plain English. Returns null when there's no time in it.
 * `now` is for tests.
 */
export function parseReminder(input: string, now = new Date()): ParsedReminder | null {
  let rest = input;
  let repeat: Repeat | null = null;
  for (const [pattern, build] of REPEATS) {
    const m = rest.match(pattern);
    if (!m || m.index === undefined) continue;
    repeat = build(m, now);
    rest = cut(rest, m.index, m[0].length);
    break;
  }

  const found = casual.parse(rest, now, { forwardDate: true })[0];
  if (found) rest = cut(rest, found.index, found.text.length);
  if (!repeat && !found) return null;

  const text = cleanText(rest);
  const tz = localTimeZone();
  const start = found?.start;
  // chrono says noon for a bare date ("tomorrow"); reminders default to 9am instead.
  const bare = start && !start.isCertain('hour') && start.get('hour') === 12;
  const hour = start && !bare ? (start.get('hour') ?? 9) : 9;
  const minute = start && !bare ? (start.get('minute') ?? 0) : 0;

  if (!repeat) {
    const at = start!.date();
    if (bare) at.setHours(9, 0, 0, 0);
    return { text, at: at.toISOString(), rrule: '', tz };
  }

  const parts = [`FREQ=${repeat.freq}`];
  if (repeat.interval && repeat.interval > 1) parts.push(`INTERVAL=${repeat.interval}`);
  if (repeat.byday) parts.push(`BYDAY=${repeat.byday.join(',')}`);
  if (repeat.bymonthday) parts.push(`BYMONTHDAY=${repeat.bymonthday}`);
  if (repeat.yearly) {
    const date = start?.isCertain('day') ? start.date() : now;
    parts.push(`BYMONTH=${date.getMonth() + 1}`, `BYMONTHDAY=${date.getDate()}`);
  }
  parts.push(`BYHOUR=${hour}`, `BYMINUTE=${minute}`);
  return { text, at: '', rrule: parts.join(';'), tz };
}

const STARTERS = [
  'every',
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'tomorrow',
  'today',
  'tonight',
  'next',
  'in',
  'on',
  'at',
  'remind',
  ...DAY_NAMES,
  ...MONTHS,
];

/** True while someone is plausibly still typing a time ("tom", "every", "9"). */
export function looksLikeReminder(query: string): boolean {
  const first = query.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return first !== '' && (/^\d/.test(first) || STARTERS.some((w) => w.startsWith(first)));
}
