import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Push } from '../lib/api';
import { Bell, Phone } from '../lib/icons';
import { disablePush, enablePush, pushState, type PushState } from '../lib/push';
import { useToast } from './Toaster';
import { Button, Dialog, Spinner, Switch } from './ui';

const PUSH_NOTE: Record<PushState, string> = {
  unsupported: 'This browser doesn’t support push notifications.',
  unconfigured: 'Push isn’t set up on this server yet (it needs VAPID keys).',
  denied: 'Notifications are blocked for this site in your browser settings.',
  on: 'On for this device: mentions, assignments and reminders, even with Folium closed.',
  off: 'Get mentions, assignments and reminders on this device, even with Folium closed.',
};

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} label="Notification settings" className="max-w-[480px]">
      <SettingsBody />
    </Dialog>
  );
}

function SettingsBody() {
  const { user, updateMe } = useAuth();
  const toast = useToast();
  const [push, setPush] = useState<PushState | null>(null);
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pushState()
      .then(setPush)
      .catch(() => setPush('unsupported'));
  }, []);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const togglePush = () =>
    run(async () => setPush(await (push === 'on' ? disablePush() : enablePush())));

  const savePhone = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await updateMe({ phone: phone.trim() });
      toast(phone.trim() ? 'Phone number saved' : 'Phone number removed');
    });
  };

  const whatsapp = Boolean(user?.whatsapp);
  return (
    <div>
      <div className="border-b border-line px-5 pb-4 pt-5">
        <h2 className="text-[15px] font-semibold text-strong">Notifications</h2>
        <p className="mt-0.5 text-[12.5px] text-muted">
          Your inbox always has everything. These reach you outside Folium too.
        </p>
      </div>

      <Row
        icon={<Bell size={16} />}
        title="Push notifications"
        note={push ? PUSH_NOTE[push] : 'Checking this browser…'}
        action={
          push === null ? (
            <Spinner />
          ) : (
            (push === 'on' || push === 'off') && (
              <Switch on={push === 'on'} disabled={busy} onChange={togglePush} label="Push" />
            )
          )
        }
      />

      <Row
        icon={<Phone size={16} />}
        title="WhatsApp reminders"
        note={
          user?.phone
            ? `Reminders also go to ${user.phone} on WhatsApp.`
            : 'Add your number to get reminders on WhatsApp.'
        }
        action={
          <Switch
            on={whatsapp}
            disabled={busy || !user?.phone}
            onChange={() => void run(() => updateMe({ whatsapp: !whatsapp }))}
            label="WhatsApp"
          />
        }
      >
        <form onSubmit={savePhone} className="mt-3 flex gap-2">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            aria-label="Phone number"
            className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-strong outline-none placeholder:text-faint focus:border-accent/60"
          />
          <Button
            type="submit"
            variant="secondary"
            className="h-9"
            disabled={busy || phone.trim() === (user?.phone ?? '')}
          >
            Save
          </Button>
        </form>
      </Row>

      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <p className="text-[12.5px] text-muted">Check that it all arrives.</p>
        <Button
          variant="ghost"
          className="h-8 text-[12.5px]"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await Push.test();
              toast('Test sent to your devices');
            })
          }
        >
          Send a test
        </Button>
      </div>
    </div>
  );
}

function Row({
  icon,
  title,
  note,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  note: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-line px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-muted">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-medium text-strong">{title}</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{note}</p>
        </div>
        {action}
      </div>
      {children && <div className="pl-7">{children}</div>}
    </div>
  );
}
