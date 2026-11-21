// Run: npm test --workspace=apps/server (also run under other TZ values: the server's own
// time zone must not matter).
import assert from 'node:assert/strict';
import { fromWall, nextRun, parseRule, toWall } from './schedule';

const at = (iso: string) => new Date(iso);
const run = (rrule: string, tz: string, after: string, anchor = after) =>
  nextRun({ at: null, rrule, tz, anchor: at(anchor) }, at(after))?.toISOString();

// "pay rent every 1st at 9am" in Kolkata → 9:00 IST = 03:30 UTC
assert.equal(
  run('FREQ=MONTHLY;BYMONTHDAY=1;BYHOUR=9;BYMINUTE=0', 'Asia/Kolkata', '2026-11-20T10:00:00Z'),
  '2026-12-01T03:30:00.000Z',
);
// already past 9am on the 1st → next month
assert.equal(
  run('FREQ=MONTHLY;BYMONTHDAY=1;BYHOUR=9;BYMINUTE=0', 'Asia/Kolkata', '2026-12-01T04:00:00Z'),
  '2027-01-01T03:30:00.000Z',
);
// daily 9am New York keeps 9am local across the March DST change (EST -5 → EDT -4)
assert.equal(
  run('FREQ=DAILY;BYHOUR=9;BYMINUTE=0', 'America/New_York', '2026-03-07T15:00:00Z'),
  '2026-03-08T13:00:00.000Z',
);
assert.equal(
  run('FREQ=DAILY;BYHOUR=9;BYMINUTE=0', 'America/New_York', '2026-03-06T15:00:00Z'),
  '2026-03-07T14:00:00.000Z',
);
// Mondays and Thursdays at 18:30 in London (Fri 20 Nov 2026 → Mon 23 Nov)
assert.equal(
  run('FREQ=WEEKLY;BYDAY=MO,TH;BYHOUR=18;BYMINUTE=30', 'Europe/London', '2026-11-20T12:00:00Z'),
  '2026-11-23T18:30:00.000Z',
);
// every 2 weeks counts from the anchor
assert.equal(
  run(
    'FREQ=WEEKLY;INTERVAL=2;BYDAY=FR;BYHOUR=9;BYMINUTE=0',
    'UTC',
    '2026-11-20T10:00:00Z',
    '2026-11-20T08:00:00Z',
  ),
  '2026-12-04T09:00:00.000Z',
);
// last day of the month
assert.equal(
  run('FREQ=MONTHLY;BYMONTHDAY=-1;BYHOUR=20;BYMINUTE=0', 'UTC', '2027-02-10T00:00:00Z'),
  '2027-02-28T20:00:00.000Z',
);
// one-off: fires once
const once = {
  at: at('2026-11-21T03:30:00Z'),
  rrule: null,
  tz: 'Asia/Kolkata',
  anchor: at('2026-11-20T00:00:00Z'),
};
assert.equal(nextRun(once, at('2026-11-20T00:00:00Z'))?.toISOString(), '2026-11-21T03:30:00.000Z');
assert.equal(nextRun(once, at('2026-11-21T03:30:00Z')), null);

// anything faster than daily, or several times a day, is refused
for (const bad of [
  'FREQ=HOURLY',
  'FREQ=MINUTELY',
  'FREQ=DAILY;BYHOUR=9,10',
  'FREQ=DAILY;COUNT=5',
  'nope',
  '',
]) {
  assert.equal(parseRule(bad), null, bad);
}

// wall-clock round trip
const instant = at('2026-07-01T12:34:00Z');
assert.equal(
  fromWall(toWall(instant, 'Asia/Kolkata'), 'Asia/Kolkata').toISOString(),
  instant.toISOString(),
);
assert.equal(toWall(instant, 'Asia/Kolkata').toISOString(), '2026-07-01T18:04:00.000Z');

console.log(`schedule checks passed (TZ=${process.env['TZ'] ?? 'system'})`);
