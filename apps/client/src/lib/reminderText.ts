import type { ReminderProps } from '@shared/types';

/** Words for reminders ("Every month on the 1st at 9:00 AM"); no parser, so it's cheap to import. */

export const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
export const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];
export const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];

export const localTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${s}`;
};

const timeOf = (hour: number, minute: number) =>
  new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(2000, 0, 1, hour, minute),
  );

const dayName = (code: string) => {
  const name = DAY_NAMES[DAYS.indexOf(code)] ?? code;
  return name[0]!.toUpperCase() + name.slice(1);
};

const list = (items: string[]) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/** "Every month on the 1st at 9:00 AM" */
export function describeRule(rrule: string, tz?: string): string {
  const get = (key: string) => rrule.match(new RegExp(`${key}=([^;]+)`))?.[1];
  const freq = get('FREQ');
  const n = Number(get('INTERVAL') ?? 1);
  const days = get('BYDAY')?.split(',') ?? [];
  const monthDay = Number(get('BYMONTHDAY'));
  const every = (unit: string) =>
    n === 1 ? `Every ${unit}` : n === 2 ? `Every other ${unit}` : `Every ${n} ${unit}s`;

  let when: string;
  if (freq === 'DAILY') when = every('day');
  else if (freq === 'WEEKLY') {
    const names = days.join(',');
    const prefix = n === 1 ? 'Every' : n === 2 ? 'Every other' : `Every ${n} weeks on`;
    if (n === 1 && names === 'MO,TU,WE,TH,FR') when = 'Every weekday';
    else if (n === 1 && names === 'SA,SU') when = 'Every weekend';
    else when = `${prefix} ${list(days.map(dayName))}`;
  } else if (freq === 'MONTHLY') {
    when = `${every('month')} on the ${monthDay === -1 ? 'last day' : ordinal(monthDay)}`;
  } else {
    const month = MONTHS[Number(get('BYMONTH')) - 1] ?? '';
    when = `${every('year')} on ${month[0]?.toUpperCase()}${month.slice(1)} ${monthDay}`;
  }
  const time = timeOf(Number(get('BYHOUR') ?? 9), Number(get('BYMINUTE') ?? 0));
  const zone = tz && tz !== localTimeZone() ? ` (${tz.split('/').at(-1)!.replace(/_/g, ' ')})` : '';
  return `${when} at ${time}${zone}`;
}

/** "Today 5:00 PM", "Tomorrow 9:00 AM", "Friday 3:00 PM", "Jan 5, 9:00 AM" */
export function describeTime(iso: string, now = new Date()): string {
  const at = new Date(iso);
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    at,
  );
  const days = Math.round(
    (new Date(at).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86_400_000,
  );
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Tomorrow ${time}`;
  if (days === -1) return `Yesterday ${time}`;
  if (days > 1 && days < 7) {
    return `${new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(at)} ${time}`;
  }
  const date = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: at.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  }).format(at);
  return `${date}, ${time}`;
}

export const describeReminder = (
  { at, rrule, tz }: Omit<ReminderProps, 'owner'>,
  now = new Date(),
) => (rrule ? describeRule(rrule, tz) : describeTime(at, now));
