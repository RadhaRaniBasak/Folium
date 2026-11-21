import { Types } from 'mongoose';
import type { NotificationItem, UpcomingReminder } from '@repo/shared';
import { AppError } from '../../errors/AppError';
import { Page } from '../../models/Page.model';
import { Reminder } from '../../models/Reminder.model';
import { User } from '../auth/models/User.model';
import { notify } from '../notifications/notifications.service';
import { memberIds } from '../workspaces/access';
import { deliver, isPushEndpoint } from './delivery';
import { scheduleReminder, type ReminderJob } from './queue';
import { isTimeZone, nextRun, parseRule } from './schedule';

/** A reminder chip found in a block snapshot. */
export interface ReminderChip {
  blockId: string;
  props: Record<string, unknown>;
  /** The block's text without the chip, e.g. "pay rent". */
  text: string;
  /** People @-mentioned in the same block; they're reminded too. */
  mentioned: string[];
  checked: boolean;
}

function readChip({ at, rrule, tz, owner }: Record<string, unknown>) {
  if (!isTimeZone(tz) || typeof owner !== 'string' || !Types.ObjectId.isValid(owner)) return null;
  if (typeof rrule === 'string' && rrule) {
    return parseRule(rrule) ? { at: null, rrule, tz, owner } : null;
  }
  const when = typeof at === 'string' ? new Date(at) : null;
  return when && !Number.isNaN(when.getTime()) ? { at: when, rrule: null, tz, owner } : null;
}

/** Brings a page's reminders in line with the chips in its latest snapshot. */
export async function syncReminders(
  page: { _id: Types.ObjectId; workspace: Types.ObjectId },
  chips: ReminderChip[],
  members: Set<string>,
): Promise<void> {
  const existing = new Map((await Reminder.find({ page: page._id })).map((r) => [r.blockId, r]));
  const keep: string[] = [];
  const now = new Date();

  for (const chip of chips.slice(0, 200)) {
    const parsed = readChip(chip.props);
    if (!parsed || !members.has(parsed.owner)) continue;
    keep.push(chip.blockId);
    const old = existing.get(chip.blockId);
    const same =
      old?.rrule === parsed.rrule &&
      old.tz === parsed.tz &&
      (old.at?.getTime() ?? null) === (parsed.at?.getTime() ?? null);

    const reminder =
      old ?? new Reminder({ workspace: page.workspace, page: page._id, blockId: chip.blockId });
    reminder.set({
      owner: parsed.owner,
      recipients: [...new Set([parsed.owner, ...chip.mentioned.filter((id) => members.has(id))])],
      text: chip.text.trim().slice(0, 500),
      checked: chip.checked,
    });
    if (!same) {
      reminder.set({ at: parsed.at, rrule: parsed.rrule, tz: parsed.tz, anchor: now });
      // A one-off time that passed before the server heard of it (saved late, or offline)
      // still goes off, unless it's more than a day late.
      const late = parsed.at && now.getTime() - parsed.at.getTime() < 24 * 60 * 60 * 1000;
      reminder.nextRunAt = nextRun(reminder, now) ?? (late ? now : null);
    }
    if (reminder.isNew || reminder.isModified()) await reminder.save();
    if (!same) await scheduleReminder(String(reminder._id), reminder.nextRunAt);
  }
  await Reminder.deleteMany({ page: page._id, blockId: { $nin: keep } });
}

/** Worker: sends one reminder and queues its next run. */
export async function fireReminder({ id, at }: ReminderJob): Promise<void> {
  const reminder = await Reminder.findById(id);
  if (reminder?.nextRunAt?.getTime() !== at) return; // edited, removed or already sent

  // Advance first: a crash mid-delivery skips one reminder rather than sending it twice.
  reminder.lastRunAt = new Date(at);
  reminder.nextRunAt = nextRun(reminder, new Date(Math.max(Date.now(), at)));
  await reminder.save();
  await scheduleReminder(id, reminder.nextRunAt);

  const page = await Page.findById(reminder.page).select('deletedAt');
  if (!page || page.deletedAt || (reminder.checked && !reminder.rrule)) return;
  const members = await memberIds(reminder.workspace);
  await notify({
    users: reminder.recipients.map(String).filter((u) => members.has(u)),
    actor: null,
    workspace: reminder.workspace,
    page: reminder.page,
    blockId: reminder.blockId,
    type: 'reminder',
    text: reminder.text,
  });
}

/** After a restart (or a Redis flush), puts every pending reminder back on the queue. */
export async function requeuePending(): Promise<number> {
  let count = 0;
  // ponytail: one pass over all pending reminders at boot; page by nextRunAt if there are millions.
  for await (const r of Reminder.find({ nextRunAt: { $ne: null } })
    .select('nextRunAt')
    .cursor()) {
    await scheduleReminder(String(r._id), r.nextRunAt);
    count++;
  }
  return count;
}

export async function listUpcoming(userId: string): Promise<UpcomingReminder[]> {
  const rows = await Reminder.find({ recipients: userId, nextRunAt: { $ne: null } })
    .sort({ nextRunAt: 1 })
    .limit(50)
    .populate<{
      page: { _id: Types.ObjectId; title?: string; icon?: string; deletedAt?: Date } | null;
    }>('page', 'title icon deletedAt');
  return rows
    .filter((r) => r.page && !r.page.deletedAt)
    .map((r) => ({
      _id: String(r._id),
      text: r.text,
      rrule: r.rrule,
      tz: r.tz,
      nextRunAt: r.nextRunAt!.toISOString(),
      page: r.page && {
        _id: String(r.page._id),
        title: r.page.title ?? '',
        icon: r.page.icon ?? null,
      },
      blockId: r.blockId,
    }));
}

// --- browser push subscriptions

interface SubscriptionInput {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
}

export async function subscribePush(userId: string, body: SubscriptionInput): Promise<void> {
  const { endpoint, keys } = body ?? {};
  if (!isPushEndpoint(endpoint)) throw new AppError('Unsupported push endpoint', 400);
  if (typeof keys?.p256dh !== 'string' || typeof keys.auth !== 'string') {
    throw new AppError('Missing push keys', 400);
  }
  await User.updateOne({ _id: userId }, { $pull: { pushSubscriptions: { endpoint } } });
  await User.updateOne(
    { _id: userId },
    {
      $push: {
        pushSubscriptions: {
          $each: [{ endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }],
          $slice: -10, // a handful of devices per person
        },
      },
    },
  );
}

export async function unsubscribePush(userId: string, endpoint: unknown): Promise<void> {
  if (typeof endpoint !== 'string') throw new AppError('endpoint is required', 400);
  await User.updateOne({ _id: userId }, { $pull: { pushSubscriptions: { endpoint } } });
}

/** "Send a test": a reminder-shaped notification to this user's devices only. */
export async function sendTest(userId: string): Promise<void> {
  const item: NotificationItem = {
    _id: `test-${Date.now()}`,
    type: 'reminder',
    actor: null,
    workspace: null,
    page: null,
    blockId: null,
    text: 'Test reminder from Folium',
    threadId: null,
    read: false,
    createdAt: new Date().toISOString(),
  };
  await deliver(userId, item);
}
