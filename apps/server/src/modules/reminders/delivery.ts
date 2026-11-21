import webpush from 'web-push';
import type { NotificationItem } from '@repo/shared';
import { User } from '../auth/models/User.model';

/** Push and WhatsApp delivery. Both are optional: without config they quietly do nothing. */

const PUSH_SERVICES = [
  'fcm.googleapis.com', // Chrome, Android
  'push.services.mozilla.com', // Firefox
  'notify.windows.com', // Edge
  'push.apple.com', // Safari
];

export function pushPublicKey(): string | null {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  return VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY ? VAPID_PUBLIC_KEY : null;
}

/**
 * Subscriptions are URLs the server will POST to, so only real browser push services are
 * accepted (no requests to internal hosts). PUSH_ALLOWED_HOSTS adds hosts for tests.
 */
export function isPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  const extra = (process.env['PUSH_ALLOWED_HOSTS'] ?? '').split(',').map((h) => h.trim());
  if (extra.includes(url.host)) return true;
  return (
    url.protocol === 'https:' &&
    PUSH_SERVICES.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`))
  );
}

interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

const pageName = (item: NotificationItem) => item.page?.title?.trim() || 'Untitled';

export function describe(item: NotificationItem): PushPayload {
  const who = item.actor?.name ?? 'Someone';
  const query = item.threadId
    ? `?thread=${encodeURIComponent(item.threadId)}`
    : item.blockId
      ? `?block=${encodeURIComponent(item.blockId)}`
      : '';
  const url = item.page ? `/p/${item.page._id}${query}` : '/';
  const base = { url, tag: item._id };
  switch (item.type) {
    case 'mention':
      return { ...base, title: `${who} mentioned you`, body: pageName(item) };
    case 'assign':
      return { ...base, title: `${who} assigned you`, body: pageName(item) };
    case 'invite':
      return {
        ...base,
        title: `${who} added you to ${item.workspace?.name ?? 'a workspace'}`,
        body: '',
      };
    case 'comment':
      return { ...base, title: `${who} commented on ${pageName(item)}`, body: item.text ?? '' };
    case 'reminder':
      return {
        ...base,
        title: `⏰ ${item.text || 'Reminder'}`,
        body: item.page ? `In ${pageName(item)}` : '',
      };
  }
}

async function sendPush(
  userId: string,
  subscriptions: { endpoint: string; keys: { p256dh: string; auth: string } }[],
  payload: PushPayload,
): Promise<void> {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  const gone: string[] = [];
  await Promise.all(
    subscriptions.map(async (sub) => {
      if (!isPushEndpoint(sub.endpoint)) return void gone.push(sub.endpoint);
      // Built here, sent with fetch: same encryption and VAPID headers as webpush.sendNotification.
      const req = webpush.generateRequestDetails(sub, JSON.stringify(payload), {
        TTL: 60 * 60,
        vapidDetails: {
          subject: VAPID_SUBJECT ?? 'mailto:admin@localhost',
          publicKey: VAPID_PUBLIC_KEY,
          privateKey: VAPID_PRIVATE_KEY,
        },
      });
      const headers = Object.fromEntries(
        Object.entries(req.headers)
          .filter(([key]) => key.toLowerCase() !== 'content-length')
          .map(([key, value]) => [key, String(value)]),
      );
      try {
        const res = await fetch(req.endpoint, {
          method: 'POST',
          headers,
          body: new Uint8Array(req.body),
          signal: AbortSignal.timeout(10_000),
        });
        if (res.status === 404 || res.status === 410) gone.push(sub.endpoint);
        else if (!res.ok) console.error(`Push rejected (${res.status}) for user ${userId}`);
      } catch (err) {
        console.error('Push failed:', err);
      }
    }),
  );
  if (gone.length > 0) {
    await User.updateOne(
      { _id: userId },
      { $pull: { pushSubscriptions: { endpoint: { $in: gone } } } },
    );
  }
}

/** WhatsApp Cloud API. Business-initiated messages need an approved template (WHATSAPP_TEMPLATE). */
export async function sendWhatsApp(phone: string, text: string): Promise<void> {
  const {
    WHATSAPP_TOKEN: token,
    WHATSAPP_PHONE_ID: phoneId,
    WHATSAPP_TEMPLATE: template,
    WHATSAPP_TEMPLATE_LANG: lang = 'en',
    WHATSAPP_API_URL: base = 'https://graph.facebook.com/v21.0',
  } = process.env;
  const to = phone.replace(/\D/g, '');
  // Template parameters can't hold newlines or long runs of spaces.
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, 1000);
  if (!token || !phoneId) {
    console.log(`[whatsapp] not configured; would send to +${to}: ${clean}`);
    return;
  }
  const message = template
    ? {
        type: 'template',
        template: {
          name: template,
          language: { code: lang },
          components: [{ type: 'body', parameters: [{ type: 'text', text: clean }] }],
        },
      }
    : { type: 'text', text: { body: clean } };
  const res = await fetch(`${base}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, ...message }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${await res.text()}`);
}

/** Sends a notification to the recipient's devices: push always, WhatsApp for reminders. */
export async function deliver(userId: string, item: NotificationItem): Promise<void> {
  const user = await User.findById(userId).select('pushSubscriptions phone whatsapp');
  if (!user) return;
  const payload = describe(item);
  const jobs: Promise<void>[] = [];
  if (user.pushSubscriptions.length > 0)
    jobs.push(sendPush(userId, user.pushSubscriptions, payload));
  if (item.type === 'reminder' && user.whatsapp && user.phone) {
    const link = `${process.env['CLIENT_URL'] ?? ''}${payload.url}`;
    const where = item.page ? ` · ${pageName(item)}` : '';
    jobs.push(sendWhatsApp(user.phone, `${payload.title}${where} ${link}`));
  }
  const results = await Promise.allSettled(jobs);
  for (const r of results) if (r.status === 'rejected') console.error('Delivery failed:', r.reason);
}
