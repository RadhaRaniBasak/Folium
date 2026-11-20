import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useMatch } from 'react-router-dom';
import { Cross, LinkChain, PersonAdd } from '../lib/icons';
import type { WorkspaceDetail, WorkspaceRole } from '@shared/types';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { Workspaces } from '../lib/api';
import { play } from '../lib/sound';
import { colorFor } from '../lib/utils';
import { Avatar, Button, Dialog, IconButton, Spinner, Tooltip } from './ui';
import { useToast } from './Toaster';

export function ShareDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} label="Share" className="max-w-[500px]">
      <ShareBody />
    </Dialog>
  );
}

const ROLE_HINT: Record<WorkspaceRole, string> = {
  owner: 'Full access',
  editor: 'Can edit',
  viewer: 'Can view',
};

function ShareBody() {
  const ws = useWorkspace();
  const { user } = useAuth();
  const toast = useToast();
  const pageId = useMatch('/p/:pageId')?.params.pageId;
  const [detail, setDetail] = useState<WorkspaceDetail | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('editor');
  const [busy, setBusy] = useState(false);
  const isOwner = ws.role === 'owner';

  const workspaceId = ws.workspace?._id;
  const load = useCallback(() => {
    if (workspaceId)
      Workspaces.detail(workspaceId)
        .then(setDetail)
        .catch(() => {});
  }, [workspaceId]);
  useEffect(load, [load]);

  const fail = (err: unknown) =>
    toast(err instanceof Error ? err.message : 'Something went wrong', { tone: 'error' });

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !email.trim()) return;
    setBusy(true);
    try {
      await Workspaces.invite(workspaceId, email.trim(), role);
      play('pop');
      toast(`Added ${email.trim()}`);
      setEmail('');
      load();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const change = async (memberId: string, next: WorkspaceRole | 'remove') => {
    if (!workspaceId) return;
    try {
      if (next === 'remove') await Workspaces.removeMember(workspaceId, memberId);
      else await Workspaces.setRole(workspaceId, memberId, next);
      load();
    } catch (err) {
      fail(err);
    }
  };

  return (
    <div>
      <div className="border-b border-line px-5 pb-4 pt-5">
        <h2 className="text-[15px] font-semibold text-strong">Share {ws.workspace?.name}</h2>
        <p className="mt-0.5 text-[12.5px] text-muted">
          Members can open every page in this workspace and edit together in real time.
        </p>

        {isOwner && (
          <form onSubmit={invite} className="mt-4 flex gap-2">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 focus-within:border-accent/60">
              <PersonAdd size={14} className="shrink-0 text-faint" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email of a Folium user"
                className="h-9 w-full bg-transparent text-[13px] text-strong outline-none placeholder:text-faint"
              />
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as WorkspaceRole)}
              className="rounded-lg border border-line bg-surface px-2 text-[13px] text-body outline-none"
              aria-label="Role"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <Button
              type="submit"
              variant="primary"
              disabled={busy || !email.trim()}
              className="h-9"
            >
              Invite
            </Button>
          </form>
        )}
      </div>

      <ul className="max-h-[40vh] overflow-y-auto p-2">
        {!detail ? (
          <li className="grid place-items-center py-8">
            <Spinner />
          </li>
        ) : (
          detail.members.map((member) => {
            const id = member.user._id;
            const isSelf = id === user?.id;
            const memberRole: WorkspaceRole = id === detail.owner ? 'owner' : member.role;
            return (
              <li key={id} className="flex items-center gap-3 rounded-lg px-3 py-2">
                <Avatar name={member.user.name} color={colorFor(id)} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-strong">
                    {member.user.name}
                    {isSelf && <span className="font-normal text-muted"> (you)</span>}
                  </span>
                  <span className="block truncate text-[12px] text-muted">{member.user.email}</span>
                </span>
                {isOwner && memberRole !== 'owner' ? (
                  <>
                    <select
                      value={memberRole}
                      onChange={(e) => void change(id, e.target.value as WorkspaceRole)}
                      className="rounded-md bg-transparent px-1 py-1 text-[12.5px] text-dim outline-none hover:bg-hover"
                      aria-label={`Role for ${member.user.name}`}
                    >
                      <option value="editor">Can edit</option>
                      <option value="viewer">Can view</option>
                    </select>
                    <Tooltip label="Remove">
                      <IconButton
                        aria-label={`Remove ${member.user.name}`}
                        onClick={() => void change(id, 'remove')}
                      >
                        <Cross size={12} />
                      </IconButton>
                    </Tooltip>
                  </>
                ) : (
                  <span className="text-[12.5px] text-muted">{ROLE_HINT[memberRole]}</span>
                )}
              </li>
            );
          })
        )}
      </ul>

      {pageId && (
        <div className="flex items-center justify-between border-t border-line px-5 py-3">
          <p className="text-[12.5px] text-muted">Only members can open the link.</p>
          <Button
            onClick={() => {
              void navigator.clipboard.writeText(`${location.origin}/p/${pageId}`);
              toast('Link copied');
            }}
          >
            <LinkChain size={13} /> Copy link
          </Button>
        </div>
      )}
    </div>
  );
}
