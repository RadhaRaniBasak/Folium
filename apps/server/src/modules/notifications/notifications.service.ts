import { Types } from 'mongoose';
import type { NotificationItem, NotificationType } from '@repo/shared';
import { Notification, type INotification } from '../../models/Notification.model';
import { emitToUser } from '../../realtime/collab';
import { deliver } from '../reminders/delivery';

type Id = Types.ObjectId | string;

interface NotifyInput {
  users: string[];
  /** Who caused it (never notified themselves); null for reminders. */
  actor: string | null;
  workspace: Id;
  type: NotificationType;
  page?: Id | null;
  blockId?: string | null;
  text?: string | null;
  threadId?: string | null;
}

const POPULATE = [
  { path: 'actor', select: 'name avatar' },
  { path: 'workspace', select: 'name' },
  { path: 'page', select: 'title icon' },
];

type Populated = Omit<INotification, 'actor' | 'workspace' | 'page'> & {
  actor: { _id: Types.ObjectId; name: string; avatar?: string } | null;
  workspace: { _id: Types.ObjectId; name: string } | null;
  page: { _id: Types.ObjectId; title?: string; icon?: string } | null;
};

function toItem(doc: unknown): NotificationItem {
  const n = doc as Populated;
  return {
    _id: String(n._id),
    type: n.type,
    actor: n.actor
      ? { _id: String(n.actor._id), name: n.actor.name, avatar: n.actor.avatar }
      : null,
    workspace: n.workspace ? { _id: String(n.workspace._id), name: n.workspace.name } : null,
    page: n.page
      ? { _id: String(n.page._id), title: n.page.title ?? '', icon: n.page.icon ?? null }
      : null,
    blockId: n.blockId ?? null,
    text: n.text ?? null,
    threadId: n.threadId ?? null,
    read: Boolean(n.readAt),
    createdAt: n.createdAt.toISOString(),
  };
}

/**
 * Records a notification for each recipient (never the actor), pushes it to their open tabs and
 * their devices. Best-effort: a failure is logged and never fails the action that caused it.
 */
export async function notify({ users, actor, ...rest }: NotifyInput): Promise<void> {
  const recipients = [...new Set(users)].filter((u) => u !== actor && Types.ObjectId.isValid(u));
  if (recipients.length === 0) return;
  try {
    const created = await Notification.insertMany(
      recipients.map((user) => ({ user, actor, ...rest })),
    );
    const populated = await Notification.populate(created, POPULATE);
    for (const n of populated) {
      const item = toItem(n);
      emitToUser(String(n.user), 'notification:new', item);
      void deliver(String(n.user), item).catch((err) => console.error('Delivery failed:', err));
    }
  } catch (err) {
    console.error('Failed to send notification:', err);
  }
}

export async function listNotifications(userId: string) {
  const [rows, unread] = await Promise.all([
    Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(50).populate(POPULATE),
    Notification.countDocuments({ user: userId, readAt: null }),
  ]);
  return { notifications: rows.map(toItem), unread };
}

/** Marks the given notifications (or all of them) as read. */
export async function markRead(userId: string, ids: unknown) {
  const filter: Record<string, unknown> = { user: userId, readAt: null };
  if (Array.isArray(ids)) {
    filter['_id'] = {
      $in: ids.filter((id) => typeof id === 'string' && Types.ObjectId.isValid(id)),
    };
  }
  const res = await Notification.updateMany(filter, { $set: { readAt: new Date() } });
  return { count: res.modifiedCount };
}
