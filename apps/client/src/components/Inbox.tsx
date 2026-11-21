import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { NotificationItem, UpcomingReminder } from '@shared/types';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { Notifications, Reminders } from '../lib/api';
import { Alarm, Check, Inbox as InboxIcon } from '../lib/icons';
import { describeRule, describeTime } from '../lib/reminderText';
import { getSocket } from '../lib/socket';
import { play } from '../lib/sound';
import { cn, colorFor, pageTitle, spring, timeAgo } from '../lib/utils';
import { PageIcon } from './Sidebar';
import { useToast } from './Toaster';
import { Avatar, Button, Dialog, Spinner } from './ui';

export interface Inbox {
  items: NotificationItem[] | null;
  unread: number;
  open: (item: NotificationItem) => void;
  markAllRead: () => void;
}

const VERB: Record<Exclude<NotificationItem['type'], 'reminder'>, string> = {
  mention: 'mentioned you in',
  assign: 'assigned you to',
  invite: 'added you to',
  comment: 'commented on',
};

function summary(item: NotificationItem): string {
  if (item.type === 'reminder') return `⏰ ${item.text || 'Reminder'}`;
  const target =
    item.type === 'invite' ? (item.workspace?.name ?? 'a workspace') : pageTitle(item.page);
  return `${item.actor?.name ?? 'Someone'} ${VERB[item.type]} ${target}`;
}

const PageName = ({ page }: { page: NotificationItem['page'] }) => (
  <span className="inline-flex items-baseline gap-1 font-medium text-strong">
    {page && <PageIcon page={page} size={13} />}
    {pageTitle(page)}
  </span>
);

const AlarmBadge = () => (
  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent/12 text-accent">
    <Alarm size={15} />
  </span>
);

/** Notifications for the signed-in user, kept live over the socket. */
export function useInbox(): Inbox {
  const ws = useWorkspace();
  const toast = useToast();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [unread, setUnread] = useState(0);

  const { openPage, switchWorkspace } = ws;
  const open = useCallback(
    (item: NotificationItem) => {
      if (!item.read) {
        setItems(
          (list) => list?.map((n) => (n._id === item._id ? { ...n, read: true } : n)) ?? null,
        );
        setUnread((u) => Math.max(0, u - 1));
        void Notifications.read([item._id]).catch(() => {});
      }
      if (item.type === 'invite' && item.workspace) switchWorkspace(item.workspace._id);
      else if (item.page) openPage(item.page._id, { block: item.blockId, thread: item.threadId });
    },
    [openPage, switchWorkspace],
  );
  // `open` changes on every navigation; the socket subscription shouldn't.
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const socket = getSocket();
    const load = () =>
      Notifications.list()
        .then((res) => {
          setItems(res.notifications);
          setUnread(res.unread);
        })
        .catch(() => setItems((list) => list ?? []));
    const onNew = (item: NotificationItem) => {
      setItems((list) => [item, ...(list ?? []).filter((n) => n._id !== item._id)].slice(0, 50));
      setUnread((u) => u + 1);
      play('pop');
      toast(summary(item), { action: { label: 'Open', onClick: () => openRef.current(item) } });
    };
    void load();
    socket.on('notification:new', onNew);
    socket.on('connect', load); // catch up on anything sent while offline
    return () => {
      socket.off('notification:new', onNew);
      socket.off('connect', load);
    };
  }, [toast]);

  const markAllRead = useCallback(() => {
    setItems((list) => list?.map((n) => ({ ...n, read: true })) ?? null);
    setUnread(0);
    void Notifications.read().catch(() => {});
  }, []);

  return { items, unread, open, markAllRead };
}

export function InboxDialog({
  inbox,
  open,
  onClose,
}: {
  inbox: Inbox;
  open: boolean;
  onClose: () => void;
}) {
  const { items, unread } = inbox;
  const [tab, setTab] = useState<'activity' | 'upcoming'>('activity');
  return (
    <Dialog open={open} onClose={onClose} label="Inbox" align="top" className="max-w-[520px]">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <InboxIcon size={16} className="text-muted" />
        <h2 className="text-[14px] font-semibold text-strong">Inbox</h2>
        <div role="tablist" className="ml-2 flex rounded-lg bg-hover p-0.5 text-[12.5px]">
          {(['activity', 'upcoming'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                'relative rounded-md px-2.5 py-1 font-medium capitalize',
                tab === t ? 'text-strong' : 'text-muted hover:text-dim',
              )}
            >
              {tab === t && (
                <motion.span
                  layoutId="inbox-tab"
                  transition={spring}
                  className="absolute inset-0 rounded-md bg-raised shadow-sm"
                />
              )}
              <span className="relative">{t === 'activity' ? 'Activity' : 'Upcoming'}</span>
            </button>
          ))}
        </div>
        {tab === 'activity' && unread > 0 && (
          <Button variant="ghost" className="ml-auto h-7 text-[12.5px]" onClick={inbox.markAllRead}>
            <Check size={13} /> Mark all as read
          </Button>
        )}
      </div>

      <div className="max-h-[60vh] overflow-y-auto p-1.5">
        {tab === 'upcoming' ? (
          <Upcoming onClose={onClose} />
        ) : items === null ? (
          <div className="grid place-items-center py-10">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[32px]">📭</p>
            <p className="mt-2 text-[13.5px] font-medium text-dim">You’re all caught up</p>
            <p className="mt-1 text-[12.5px] text-faint">
              Mentions, assignments, invites and reminders show up here.
            </p>
          </div>
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <motion.li
                  key={item._id}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={spring}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      inbox.open(item);
                    }}
                    className="hover-fill flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left"
                  >
                    {item.type === 'reminder' ? (
                      <AlarmBadge />
                    ) : (
                      <Avatar
                        name={item.actor?.name ?? '?'}
                        color={colorFor(item.actor?._id ?? '')}
                        size={28}
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      {item.type === 'reminder' ? (
                        <span className="block text-[13.5px] leading-snug text-body">
                          <span className="font-semibold text-strong">
                            {item.text || 'Reminder'}
                          </span>{' '}
                          in <PageName page={item.page} />
                        </span>
                      ) : (
                        <span className="block text-[13.5px] leading-snug text-body">
                          <span className="font-semibold text-strong">
                            {item.actor?.name ?? 'Someone'}
                          </span>{' '}
                          {VERB[item.type]}{' '}
                          {item.type === 'invite' ? (
                            <span className="font-medium text-strong">{item.workspace?.name}</span>
                          ) : (
                            <PageName page={item.page} />
                          )}
                        </span>
                      )}
                      {item.type === 'comment' && item.text && (
                        <span className="mt-1 block truncate border-l-2 border-line pl-2 text-[12.5px] text-dim">
                          {item.text}
                        </span>
                      )}
                      <span className="mt-0.5 block text-[12px] text-faint">
                        {timeAgo(item.createdAt)}
                        {item.type !== 'invite' && item.workspace && ` · ${item.workspace.name}`}
                      </span>
                    </span>
                    <span
                      aria-label={item.read ? undefined : 'Unread'}
                      className={cn(
                        'mt-2 size-2 shrink-0 rounded-full',
                        item.read ? 'bg-transparent' : 'bg-accent',
                      )}
                    />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </Dialog>
  );
}

/** Reminders still to come for this person, soonest first. */
function Upcoming({ onClose }: { onClose: () => void }) {
  const { openPage } = useWorkspace();
  const [list, setList] = useState<UpcomingReminder[] | null>(null);
  useEffect(() => {
    Reminders.upcoming()
      .then(setList)
      .catch(() => setList([]));
  }, []);

  if (list === null) {
    return (
      <div className="grid place-items-center py-10">
        <Spinner />
      </div>
    );
  }
  if (list.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-[32px]">⏰</p>
        <p className="mt-2 text-[13.5px] font-medium text-dim">No reminders coming up</p>
        <p className="mt-1 text-[12.5px] text-faint">
          Type @ in a page (“@tomorrow 5pm”) or try “pay rent every 1st at 9am” in search.
        </p>
      </div>
    );
  }
  return (
    <ul>
      {list.map((r) => (
        <li key={r._id}>
          <button
            type="button"
            onClick={() => {
              onClose();
              if (r.page) openPage(r.page._id, { block: r.blockId });
            }}
            className="hover-fill flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left"
          >
            <AlarmBadge />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold text-strong">
                {r.text || 'Reminder'}
              </span>
              <span className="mt-0.5 block text-[12px] text-muted">
                {describeTime(r.nextRunAt)}
                {r.rrule && ` · ${describeRule(r.rrule, r.tz)}`}
              </span>
              <span className="mt-0.5 block text-[12px] text-faint">
                <PageName page={r.page} />
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
