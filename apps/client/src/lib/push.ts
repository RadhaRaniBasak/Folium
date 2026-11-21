import { Push } from './api';

/** Browser push for this device. The server only stores the subscription. */

export type PushState = 'unsupported' | 'unconfigured' | 'denied' | 'on' | 'off';

const supported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function registration(): Promise<ServiceWorkerRegistration> {
  // Built apps have the PWA worker (it imports push-sw.js); the dev server has none.
  if (!(await navigator.serviceWorker.getRegistration())) {
    await navigator.serviceWorker.register('/push-sw.js');
  }
  return navigator.serviceWorker.ready;
}

const current = async () =>
  supported()
    ? ((await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription()) ??
      null)
    : null;

export async function pushState(): Promise<PushState> {
  if (!supported()) return 'unsupported';
  if (!(await Push.key())) return 'unconfigured';
  if (Notification.permission === 'denied') return 'denied';
  return (await current()) ? 'on' : 'off';
}

export async function enablePush(): Promise<PushState> {
  const key = await Push.key();
  if (!key) return 'unconfigured';
  if ((await Notification.requestPermission()) !== 'granted') return 'denied';
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(key) }));
  await Push.subscribe(sub.toJSON());
  return 'on';
}

/** Also run on logout, so the next person on this browser doesn't get your notifications. */
export async function disablePush(): Promise<PushState> {
  const sub = await current();
  if (sub) {
    await Push.unsubscribe(sub.endpoint).catch(() => {});
    await sub.unsubscribe();
  }
  return 'off';
}

function bytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
