// Run: npm test --workspace=apps/client
process.env.TZ = 'Asia/Kolkata';
import assert from 'node:assert/strict';
import { describeRule, describeTime, looksLikeReminder, parseReminder } from './reminders';

const now = new Date('2026-11-20T15:34:00+05:30'); // a Friday afternoon in Kolkata
const parse = (text: string) => {
  const r = parseReminder(text, now);
  return r && { text: r.text, at: r.at, rrule: r.rrule };
};

assert.deepEqual(parse('pay rent every 1st at 9am'), {
  text: 'pay rent',
  at: '',
  rrule: 'FREQ=MONTHLY;BYMONTHDAY=1;BYHOUR=9;BYMINUTE=0',
});
assert.deepEqual(parse('Standup every weekday at 9:30'), {
  text: 'Standup',
  at: '',
  rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=9;BYMINUTE=30',
});
assert.equal(
  parse('water plants every Monday and Thursday at 7am')?.rrule,
  'FREQ=WEEKLY;BYDAY=MO,TH;BYHOUR=7;BYMINUTE=0',
);
assert.equal(
  parse('bins every other tuesday 8pm')?.rrule,
  'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU;BYHOUR=20;BYMINUTE=0',
);
assert.equal(parse('daily standup at 10')?.rrule, 'FREQ=DAILY;BYHOUR=10;BYMINUTE=0');
assert.equal(
  parse('check the meter every month on the 15th')?.rrule,
  'FREQ=MONTHLY;BYMONTHDAY=15;BYHOUR=9;BYMINUTE=0',
);
assert.equal(
  parse('invoice every last day of the month at 6pm')?.rrule,
  'FREQ=MONTHLY;BYMONTHDAY=-1;BYHOUR=18;BYMINUTE=0',
);
assert.deepEqual(parse('renew passport every year on jan 5'), {
  text: 'renew passport',
  at: '',
  rrule: 'FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=5;BYHOUR=9;BYMINUTE=0',
});
assert.equal(parse('every month')?.rrule, 'FREQ=MONTHLY;BYMONTHDAY=20;BYHOUR=9;BYMINUTE=0');
// "every month" must not read as "every mon(day)"
assert.equal(
  parse('every month on the 2nd')?.rrule,
  'FREQ=MONTHLY;BYMONTHDAY=2;BYHOUR=9;BYMINUTE=0',
);

assert.deepEqual(parse('Call mom tomorrow at 5pm'), {
  text: 'Call mom',
  at: '2026-11-21T11:30:00.000Z',
  rrule: '',
});
assert.equal(parse('dentist on dec 3')?.at, '2026-12-03T03:30:00.000Z', 'a bare date means 9am');
assert.equal(parse('remind me to stretch in 5 seconds')?.text, 'stretch');
assert.equal(parse('remind me to stretch in 5 seconds')?.at, '2026-11-20T10:04:05.000Z');
assert.equal(parse('just some text'), null);

assert.equal(
  describeRule('FREQ=MONTHLY;BYMONTHDAY=1;BYHOUR=9;BYMINUTE=0'),
  'Every month on the 1st at 9:00 AM',
);
assert.equal(
  describeRule('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=9;BYMINUTE=30'),
  'Every weekday at 9:30 AM',
);
assert.equal(
  describeRule('FREQ=WEEKLY;BYDAY=MO,WE,FR;BYHOUR=7;BYMINUTE=0'),
  'Every Monday, Wednesday and Friday at 7:00 AM',
);
assert.equal(
  describeRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU;BYHOUR=20;BYMINUTE=0'),
  'Every other Tuesday at 8:00 PM',
);
assert.equal(describeRule('FREQ=DAILY;INTERVAL=3;BYHOUR=8;BYMINUTE=0'), 'Every 3 days at 8:00 AM');
assert.equal(
  describeRule('FREQ=MONTHLY;BYMONTHDAY=-1;BYHOUR=18;BYMINUTE=0'),
  'Every month on the last day at 6:00 PM',
);
assert.equal(
  describeRule('FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=5;BYHOUR=9;BYMINUTE=0'),
  'Every year on Jan 5 at 9:00 AM',
);
assert.equal(
  describeRule('FREQ=DAILY;BYHOUR=9;BYMINUTE=0', 'America/New_York'),
  'Every day at 9:00 AM (New York)',
);
assert.equal(describeTime('2026-11-21T11:30:00.000Z', now), 'Tomorrow 5:00 PM');
assert.equal(describeTime('2026-11-20T12:30:00.000Z', now), 'Today 6:00 PM');
assert.equal(describeTime('2026-11-24T03:30:00.000Z', now), 'Tuesday 9:00 AM');
assert.equal(describeTime('2027-01-05T03:30:00.000Z', now), 'Jan 5, 2027, 9:00 AM');

for (const q of ['tom', 'every', 'every 1st at', '9', 'next fri'])
  assert.ok(looksLikeReminder(q), q);
for (const q of ['info', 'bob', '']) assert.ok(!looksLikeReminder(q), q);

console.log('reminder parser checks passed');
