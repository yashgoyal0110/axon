import { motion } from 'framer-motion';
import {
  Building2,
  Copy,
  KeyRound,
  Link2,
  Lock,
  Plus,
  ScrollText,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Skeleton, Tab, TabList, Tabs } from '@/components/ui';
import { PageHeader, PageShell } from '@/components/app/AppLayout';
import { ApiError, del, get, patch, post } from '@/lib/api';
import { useAuth, useCan } from '@/lib/store';
import type { ApiKey, AuditEntry, Invitation, Member, Paginated, Role } from '@/lib/types';
import { avatarGradient, cn, copyToClipboard, formatDate, formatRelative, initials } from '@/lib/utils';

type TabKey = 'workspace' | 'team' | 'api' | 'audit' | 'account';

export default function Settings() {
  const [tab, setTab] = useState<TabKey>('workspace');
  const isAdmin = useCan('ADMIN');

  return (
    <PageShell>
      <PageHeader title="Settings" description="Workspace, team, API access and your own account." />

      <Tabs value={tab} onChange={(v) => setTab(v as TabKey)} className="mb-6">
        <TabList className="w-fit">
          <Tab value="workspace" icon={Building2}>
            Workspace
          </Tab>
          <Tab value="team" icon={Users}>
            Team
          </Tab>
          {isAdmin && (
            <Tab value="api" icon={KeyRound}>
              API keys
            </Tab>
          )}
          {isAdmin && (
            <Tab value="audit" icon={ScrollText}>
              Audit log
            </Tab>
          )}
          <Tab value="account" icon={Lock}>
            Account
          </Tab>
        </TabList>
      </Tabs>

      <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {tab === 'workspace' && <WorkspaceTab />}
        {tab === 'team' && <TeamTab />}
        {tab === 'api' && <ApiKeysTab />}
        {tab === 'audit' && <AuditTab />}
        {tab === 'account' && <AccountTab />}
      </motion.div>
    </PageShell>
  );
}

// ---------------------------------------------------------------------------

function WorkspaceTab() {
  const canEdit = useCan('ADMIN');
  const { organization, setProfile } = useAuth();
  const [form, setForm] = useState({ name: '', billingEmail: '' });
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void get<{ name: string; billingEmail: string | null; _count: Record<string, number> }>('/org').then((org) => {
      setForm({ name: org.name, billingEmail: org.billingEmail ?? '' });
      setCounts(org._count);
    });
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await patch('/org', { name: form.name, billingEmail: form.billingEmail || undefined });
      const profile = await get<Parameters<typeof setProfile>[0]>('/auth/me');
      setProfile(profile);
      toast.success('Workspace updated');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card className="p-6">
        <h2 className="mb-5 text-[15px] font-semibold text-white">Workspace details</h2>
        <div className="space-y-4">
          <Field label="Workspace name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!canEdit} />
          </Field>
          <Field label="Billing email" hint="Where invoices and quota warnings would be sent.">
            <Input
              type="email"
              value={form.billingEmail}
              onChange={(e) => setForm({ ...form, billingEmail: e.target.value })}
              disabled={!canEdit}
            />
          </Field>
          <Field label="Workspace ID" hint="Referenced in audit logs and API responses.">
            <Input value={organization?.id ?? ''} readOnly className="font-mono text-[12px] text-slate-500" />
          </Field>
        </div>
        {canEdit && (
          <Button className="mt-5" onClick={save} loading={busy}>
            Save changes
          </Button>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="mb-5 text-[15px] font-semibold text-white">At a glance</h2>
        {!counts ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {[
              ['Members', counts.memberships],
              ['Flows', counts.flows],
              ['Channels', counts.channels],
              ['Contacts', counts.contacts],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="font-display text-2xl font-bold text-white">{value as number}</p>
                <p className="mt-0.5 text-[11.5px] text-slate-500">{label as string}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

const ROLE_HELP: Record<Role, string> = {
  OWNER: 'Full control, including billing and deleting the workspace.',
  ADMIN: 'Manage channels, team, API keys and everything below.',
  AGENT: 'Build flows and reply to conversations.',
  VIEWER: 'Read-only access to flows, inbox and analytics.',
};

function TeamTab() {
  const canManage = useCan('ADMIN');
  const currentUser = useAuth((s) => s.user);

  const [data, setData] = useState<{ members: Member[]; invitations: Invitation[] } | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const load = () => get<{ members: Member[]; invitations: Invitation[] }>('/org/members').then(setData);

  useEffect(() => {
    void load();
  }, []);

  const setRole = async (userId: string, role: Role) => {
    try {
      await patch(`/org/members/${userId}/role`, { role });
      toast.success('Role updated');
      void load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not update the role');
    }
  };

  const remove = async (userId: string) => {
    try {
      await del(`/org/members/${userId}`);
      toast.success('Member removed');
      void load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not remove');
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-white">Members</h2>
          {canManage && (
            <Button size="sm" icon={UserPlus} onClick={() => setShowInvite(true)}>
              Invite
            </Button>
          )}
        </div>

        {!data ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {data.members.map((member) => (
              <div
                key={member.id}
                className="flex flex-wrap items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-ink-950',
                    avatarGradient(member.user.id),
                  )}
                >
                  {initials(member.user.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-slate-200">
                    {member.user.name}
                    {member.user.id === currentUser?.id && <span className="ml-1.5 text-[11px] text-slate-600">(you)</span>}
                  </p>
                  <p className="truncate text-[11.5px] text-slate-600">
                    {member.user.email}
                    {member.user.lastLoginAt && ` · last seen ${formatRelative(member.user.lastLoginAt)}`}
                  </p>
                </div>

                {canManage && member.user.id !== currentUser?.id ? (
                  <>
                    <Select
                      value={member.role}
                      onChange={(e) => setRole(member.user.id, e.target.value as Role)}
                      className="h-8 w-28 text-[12px]"
                    >
                      {(Object.keys(ROLE_HELP) as Role[]).map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </Select>
                    <button
                      onClick={() => remove(member.user.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <Badge tone={member.role === 'OWNER' ? 'mint' : 'slate'}>{member.role}</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {!!data?.invitations.length && (
        <Card className="p-6">
          <h2 className="mb-4 text-[15px] font-semibold text-white">Pending invitations</h2>
          <div className="space-y-2">
            {data.invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-slate-200">{invitation.email}</p>
                  <p className="text-[11.5px] text-slate-600">Expires {formatDate(invitation.expiresAt)}</p>
                </div>
                <Badge tone="slate">{invitation.role}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Link2}
                  onClick={async () => {
                    const url = `${window.location.origin}/accept-invite?token=${invitation.token}`;
                    const ok = await copyToClipboard(url);
                    toast[ok ? 'success' : 'error'](ok ? 'Invite link copied' : 'Copy failed');
                  }}
                >
                  Copy link
                </Button>
                {canManage && (
                  <button
                    onClick={async () => {
                      await del(`/org/members/invite/${invitation.id}`);
                      toast.success('Invitation revoked');
                      void load();
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-rose-500/10 hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <InviteModal
        open={showInvite}
        onClose={() => {
          setShowInvite(false);
          setInviteUrl(null);
        }}
        inviteUrl={inviteUrl}
        onInvited={(url) => {
          setInviteUrl(url);
          void load();
        }}
      />
    </div>
  );
}

function InviteModal({
  open,
  onClose,
  onInvited,
  inviteUrl,
}: {
  open: boolean;
  onClose: () => void;
  onInvited: (url: string) => void;
  inviteUrl: string | null;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('AGENT');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setEmail('');
  }, [open]);

  const invite = async () => {
    setBusy(true);
    try {
      const result = await post<Invitation>('/org/members/invite', { email, role });
      onInvited(result.inviteUrl ?? `${window.location.origin}/accept-invite?token=${result.token}`);
      toast.success('Invitation created');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not invite');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite a teammate"
      description="No email provider is wired up, so share the link yourself."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={invite} loading={busy} disabled={!email.trim()}>
            Create invitation
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Email" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" />
        </Field>

        <Field label="Role" hint={ROLE_HELP[role]}>
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {(Object.keys(ROLE_HELP) as Role[]).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>

        {inviteUrl && (
          <div className="rounded-xl border border-mint-400/25 bg-mint-400/[0.07] p-4">
            <p className="mb-2 text-[12.5px] font-medium text-mint-200">Share this link</p>
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-ink-950/60 px-2.5 py-2">
              <code className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-slate-400">{inviteUrl}</code>
              <button
                onClick={async () => {
                  const ok = await copyToClipboard(inviteUrl);
                  toast[ok ? 'success' : 'error'](ok ? 'Copied' : 'Copy failed');
                }}
                className="shrink-0 text-slate-500 hover:text-mint-300"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function ApiKeysTab() {
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => get<ApiKey[]>('/org/api-keys').then(setKeys);

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      const result = await post<ApiKey>('/org/api-keys', { name });
      setNewKey(result.key ?? null);
      setName('');
      void load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not create the key');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-white">API keys</h2>
            <p className="mt-0.5 text-[12.5px] text-slate-500">
              Machine-to-machine access. Send as <code className="font-mono text-[11.5px]">x-api-key</code>.
            </p>
          </div>
          <Button size="sm" icon={Plus} onClick={() => setShowCreate(true)}>
            New key
          </Button>
        </div>

        {!keys ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : keys.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="No API keys yet"
            description="Create one to drive flows, channels and conversations from your own systems."
          />
        ) : (
          <div className="space-y-2">
            {keys.map((key) => (
              <div
                key={key.id}
                className={cn(
                  'flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3',
                  key.revokedAt ? 'border-white/[0.05] bg-white/[0.01] opacity-55' : 'border-white/[0.07] bg-white/[0.02]',
                )}
              >
                <KeyRound className="h-4 w-4 shrink-0 text-slate-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-200">{key.name}</p>
                  <p className="truncate font-mono text-[11px] text-slate-600">
                    ax_{key.prefix}_••••••••
                    {key.lastUsedAt ? ` · used ${formatRelative(key.lastUsedAt)}` : ' · never used'}
                  </p>
                </div>
                {key.revokedAt ? (
                  <Badge tone="rose">revoked</Badge>
                ) : (
                  <button
                    onClick={async () => {
                      await del(`/org/api-keys/${key.id}`);
                      toast.success('Key revoked');
                      void load();
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-rose-500/10 hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          setNewKey(null);
        }}
        title="New API key"
        description="The secret is shown once and never again."
        footer={
          newKey ? (
            <Button
              onClick={() => {
                setShowCreate(false);
                setNewKey(null);
              }}
            >
              Done
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button onClick={create} loading={busy} disabled={!name.trim()}>
                Create key
              </Button>
            </>
          )
        }
      >
        {newKey ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3">
              <p className="text-[12.5px] leading-relaxed text-amber-200/90">
                Copy this now. Once you close this dialog it cannot be recovered.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-ink-950/70 px-3 py-2.5">
              <code className="min-w-0 flex-1 break-all font-mono text-[11.5px] text-mint-300">{newKey}</code>
              <button
                onClick={async () => {
                  const ok = await copyToClipboard(newKey);
                  toast[ok ? 'success' : 'error'](ok ? 'Copied' : 'Copy failed');
                }}
                className="shrink-0 text-slate-500 hover:text-mint-300"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <Field label="Key name" hint="What is it for? e.g. Zapier, internal CRM sync." required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Zapier integration" />
          </Field>
        )}
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------

function AuditTab() {
  const [log, setLog] = useState<Paginated<AuditEntry> | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    void get<Paginated<AuditEntry>>(`/org/audit?page=${page}&pageSize=40`).then(setLog);
  }, [page]);

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-[15px] font-semibold text-white">Audit log</h2>
      <p className="mb-5 text-[12.5px] text-slate-500">Every mutation in this workspace, most recent first.</p>

      {!log ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : log.items.length === 0 ? (
        <EmptyState icon={Shield} title="Nothing recorded yet" />
      ) : (
        <>
          <div className="divide-y divide-white/[0.05]">
            {log.items.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <code className="shrink-0 rounded-md bg-white/[0.05] px-2 py-0.5 font-mono text-[10.5px] text-mint-300">
                  {entry.action}
                </code>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-400">
                  {entry.actor ? entry.actor.name : 'System'}
                  {entry.target && <span className="ml-1.5 font-mono text-[11px] text-slate-600">{entry.target}</span>}
                </span>
                {entry.ip && <span className="shrink-0 font-mono text-[10.5px] text-slate-700">{entry.ip}</span>}
                <span className="shrink-0 text-[11.5px] text-slate-600">{formatRelative(entry.createdAt)}</span>
              </div>
            ))}
          </div>

          {log.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-[12px] text-slate-500">
                Page {log.page} of {log.totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= log.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------

function AccountTab() {
  const { user, setProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [passwords, setPasswords] = useState({ current: '', next: '' });
  const [busy, setBusy] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const saveProfile = async () => {
    setBusy(true);
    try {
      await patch('/auth/profile', { name });
      const profile = await get<Parameters<typeof setProfile>[0]>('/auth/me');
      setProfile(profile);
      toast.success('Profile updated');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async () => {
    setChangingPassword(true);
    try {
      await post('/auth/change-password', {
        currentPassword: passwords.current,
        newPassword: passwords.next,
      });
      setPasswords({ current: '', next: '' });
      toast.success('Password changed - other devices have been signed out');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not change the password');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-6">
        <h2 className="mb-5 text-[15px] font-semibold text-white">Your profile</h2>
        <div className="space-y-4">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email" hint="Contact an admin to change the email on your account.">
            <Input value={user?.email ?? ''} readOnly className="text-slate-500" />
          </Field>
        </div>
        <Button className="mt-5" onClick={saveProfile} loading={busy}>
          Save profile
        </Button>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 text-[15px] font-semibold text-white">Change password</h2>
        <p className="mb-5 text-[12.5px] text-slate-500">Every other session is revoked when you change it.</p>
        <div className="space-y-4">
          <Field label="Current password">
            <Input
              type="password"
              autoComplete="current-password"
              value={passwords.current}
              onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
            />
          </Field>
          <Field label="New password" hint="At least 8 characters.">
            <Input
              type="password"
              autoComplete="new-password"
              value={passwords.next}
              onChange={(e) => setPasswords({ ...passwords, next: e.target.value })}
            />
          </Field>
        </div>
        <Button
          className="mt-5"
          onClick={changePassword}
          loading={changingPassword}
          disabled={!passwords.current || passwords.next.length < 8}
        >
          Change password
        </Button>
      </Card>
    </div>
  );
}
