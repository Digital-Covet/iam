import { useEffect, useState } from 'react'
import type { RequestPayload } from '@inertiajs/core'
import { Dialog } from '@base-ui/react/dialog'
import { Tabs } from '@base-ui/react/tabs'
import {
  CheckCircle2,
  CircleAlert,
  Loader2,
  MonitorSmartphone,
  TriangleAlert,
  X,
} from 'lucide-react'
import { usePermissions } from '~/hooks/use-permissions'
import { cn } from '~/lib/utils'
import { ToggleSwitch } from '~/components/ui/switch'
import { ConfirmDialog } from './confirm-dialog'
import {
  Avatar,
  StatusBadge,
  Stamp,
  btnDanger,
  btnPrimary,
  btnSecondary,
  describeAgent,
  dialogBackdrop,
  displayName,
  SelectField,
  TwoFactorBadge,
  focusRing,
  humanizeAction,
  mutate,
  type DirectoryUser,
  type RoleOption,
  type UserDetail,
} from './shared'

type Props = {
  user: DirectoryUser | null
  roles: RoleOption[]
  viewerId: string | undefined
  onClose: () => void
}

type Pending =
  | { kind: 'revoke-app'; slug: string; appName: string }
  | { kind: 'revoke-session'; sessionId: string; label: string }
  | { kind: 'revoke-all' }
  | { kind: 'reset-2fa' }
  | null

const tabClass = cn(
  'h-11 border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground transition-colors duration-140 hover:text-foreground data-active:border-primary data-active:text-primary motion-reduce:transition-none',
  focusRing
)

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-muted-foreground">
      <TriangleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-warning" />
      <span>{children}</span>
    </p>
  )
}

/** Keyed by person so each one opens on a fresh tab, detail fetch and draft role. */
export function UserSheet(props: Props) {
  return <UserSheetContent key={props.user?.id ?? 'closed'} {...props} />
}

function UserSheetContent({ user, roles, viewerId, onClose }: Props) {
  const { can, isSuperadmin } = usePermissions()
  const [tab, setTab] = useState('overview')
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Pending>(null)

  const userId = user?.id
  const roleName = user?.role?.name ?? ''
  const [role, setRole] = useState(roleName)

  // Fetch on open; refetch after every mutation (`version`).
  useEffect(() => {
    if (!userId) return
    const controller = new AbortController()
    fetch(`/directory/${userId}`, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status))
        return res.json() as Promise<UserDetail>
      })
      .then((next) => {
        setDetail(next)
        setLoadError(false)
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') setLoadError(true)
      })
    return () => controller.abort()
  }, [userId, version])

  function act(method: 'post' | 'patch' | 'delete', url: string, data?: RequestPayload) {
    setBusy(true)
    mutate(method, url, data, () => {
      setBusy(false)
      setVersion((v) => v + 1)
    })
  }

  const isSelf = !!user && user.id === viewerId
  const targetIsSuperadmin = user?.roleName === 'superadmin'
  const canEditRole = can('users.update') && !isSelf && (isSuperadmin || !targetIsSuperadmin)
  const roleReason = !can('users.update')
    ? 'You do not have permission to change roles.'
    : isSelf
      ? 'You cannot change your own role.'
      : !isSuperadmin && targetIsSuperadmin
        ? 'Only superadmins can change a superadmin’s role.'
        : null

  const canEditSessions = can('sessions.revoke') && (isSuperadmin || !targetIsSuperadmin)

  function confirmCopy() {
    if (!user || !pending) return null
    const who = displayName(user)
    if (pending.kind === 'revoke-app')
      return {
        title: `Revoke ${pending.appName} access?`,
        body: `${who} will lose access to ${pending.appName}, and their active ${pending.appName} tokens end immediately.`,
        label: 'Revoke access',
      }
    if (pending.kind === 'revoke-session')
      return {
        title: 'Sign out this device?',
        body: `${pending.label} will be signed out of ${who}'s account.`,
        label: 'Sign out device',
      }
    if (pending.kind === 'reset-2fa')
      return {
        title: 'Reset two-factor?',
        body: `${who} will be signed out everywhere and must set up 2FA again. Their backup codes stop working.`,
        label: 'Reset 2FA',
      }
    return {
      title: 'Sign out of all devices?',
      body: isSelf
        ? 'Every other device signed in as you will be signed out. This one stays signed in.'
        : `${who} will be signed out everywhere and must sign in again.`,
      label: 'Sign out everywhere',
    }
  }
  const copy = confirmCopy()

  function runPending() {
    if (!user || !pending) return
    if (pending.kind === 'revoke-app')
      act('patch', `/directory/${user.id}/entitlements`, { app: pending.slug, enabled: false })
    else if (pending.kind === 'revoke-session')
      act('delete', `/directory/${user.id}/sessions/${pending.sessionId}`)
    else if (pending.kind === 'reset-2fa') act('delete', `/directory/${user.id}/two-factor`)
    else act('delete', `/directory/${user.id}/sessions`)
  }

  const nothingToShow = !detail && !loadError

  return (
    <>
      <Dialog.Root open={!!user} onOpenChange={(open) => !open && onClose()}>
        <Dialog.Portal>
          <Dialog.Backdrop className={dialogBackdrop} />
          <Dialog.Popup className="fixed inset-y-0 right-0 z-50 flex w-[min(32rem,100vw)] flex-col border-l border-border bg-surface-raised shadow-float transition-[opacity,translate] duration-180 data-ending-style:translate-x-4 data-ending-style:opacity-0 data-starting-style:translate-x-4 data-starting-style:opacity-0 motion-reduce:transition-none">
            {user && (
              <>
                <header className="folio-rule flex items-start gap-4 p-5">
                  <Avatar user={user} size={48} />
                  <div className="min-w-0 flex-1">
                    <Dialog.Title className="truncate text-xl leading-tight font-semibold">
                      {displayName(user)}
                    </Dialog.Title>
                    <Dialog.Description className="truncate text-sm text-muted-foreground">
                      {user.email}
                    </Dialog.Description>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={user.status} />
                      <span className="text-sm text-muted-foreground">
                        {user.role?.name ?? 'No role'}
                      </span>
                    </div>
                  </div>
                  <Dialog.Close
                    aria-label="Close details"
                    className={cn(
                      'grid size-10 shrink-0 place-items-center rounded-md hover:bg-hover',
                      focusRing
                    )}
                  >
                    <X size={18} aria-hidden="true" />
                  </Dialog.Close>
                </header>

                <Tabs.Root
                  value={tab}
                  onValueChange={(v) => setTab(String(v))}
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <Tabs.List
                    aria-label="User details"
                    className="flex gap-1 overflow-x-auto border-b border-border px-3"
                  >
                    <Tabs.Tab value="overview" className={tabClass}>
                      Overview
                    </Tabs.Tab>
                    <Tabs.Tab value="role" className={tabClass}>
                      Role
                    </Tabs.Tab>
                    <Tabs.Tab value="access" className={tabClass}>
                      App access
                    </Tabs.Tab>
                    <Tabs.Tab value="sessions" className={tabClass}>
                      Sessions
                    </Tabs.Tab>
                  </Tabs.List>

                  <div className="min-h-0 flex-1 overflow-y-auto p-5" aria-busy={nothingToShow}>
                    {loadError && (
                      <div
                        role="alert"
                        className="flex items-start gap-2 rounded-lg border border-error/40 bg-error/10 px-3 py-2.5 text-sm text-error"
                      >
                        <CircleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
                        <p className="flex-1">Couldn’t load this person’s details.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setLoadError(false)
                            setVersion((v) => v + 1)
                          }}
                          className={cn('rounded-sm font-medium underline', focusRing)}
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    <Tabs.Panel value="overview" className="outline-none">
                      <dl className="divide-y divide-border">
                        <Field label="Status">
                          <StatusBadge status={user.status} />
                        </Field>
                        <Field label="Email verified">
                          {user.emailVerified ? 'Yes' : 'No — invitation pending'}
                        </Field>
                        <Field label="Two-factor">
                          <TwoFactorBadge enabled={user.twoFactorEnabled} />
                        </Field>
                        {user.twoFactorEnabled &&
                          can('users.mfa.reset') &&
                          (isSuperadmin || !targetIsSuperadmin) && (
                            <div className="py-2.5">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setPending({ kind: 'reset-2fa' })}
                                className={cn(btnSecondary, 'h-9 text-sm')}
                              >
                                Reset 2FA
                              </button>
                            </div>
                          )}
                        <Field label="Joined">
                          <Stamp value={user.joined} />
                        </Field>
                        <Field label="Last active">
                          <Stamp value={user.lastActive} />
                        </Field>
                        {user.status === 'suspended' && (
                          <>
                            <Field label="Suspended">
                              <Stamp value={user.bannedAt} />
                            </Field>
                            <Field label="Reason">{user.banReason || 'No reason recorded'}</Field>
                          </>
                        )}
                      </dl>

                      {can('audit.read') && (
                        <section className="mt-6" aria-labelledby="recent-activity">
                          <h3 id="recent-activity" className="text-sm font-semibold">
                            Recent activity
                          </h3>
                          {nothingToShow ? (
                            <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
                          ) : detail && detail.audit.length > 0 ? (
                            <ul className="mt-2 divide-y divide-border">
                              {detail.audit.map((e) => {
                                const ok = e.status === 'success'
                                const Icon = ok ? CheckCircle2 : CircleAlert
                                return (
                                  <li
                                    key={e.id}
                                    className="flex items-start justify-between gap-3 py-2.5 text-sm"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate font-medium">
                                        {humanizeAction(e.action)}
                                      </p>
                                      <p className="font-mono text-xs text-muted-foreground tabular-nums">
                                        <Stamp value={e.created} />
                                      </p>
                                    </div>
                                    <span
                                      className={cn(
                                        'inline-flex shrink-0 items-center gap-1.5',
                                        ok ? 'text-success' : 'text-error'
                                      )}
                                    >
                                      <Icon size={14} aria-hidden="true" />
                                      {ok ? 'Success' : 'Failure'}
                                    </span>
                                  </li>
                                )
                              })}
                            </ul>
                          ) : (
                            <p className="mt-2 text-sm text-muted-foreground">
                              No activity has been recorded for this person.
                            </p>
                          )}
                        </section>
                      )}
                    </Tabs.Panel>

                    <Tabs.Panel value="role" className="space-y-4 outline-none">
                      <div className="space-y-1.5">
                        <SelectField
                          label="Role"
                          value={role}
                          disabled={!canEditRole || busy}
                          onValueChange={setRole}
                          describedBy="sheet-role-note"
                          options={[
                            ...(user.role ? [] : [{ value: '', label: 'No role' }]),
                            ...roles.map((r) => ({
                              value: r.name,
                              label: r.name,
                              disabled: !isSuperadmin && r.name.toLowerCase() === 'superadmin',
                            })),
                          ]}
                        />
                        <p id="sheet-role-note" className="text-sm text-muted-foreground">
                          {roleReason ??
                            roles.find((r) => r.name === role)?.description ??
                            'Roles decide which permissions this person has.'}
                        </p>
                      </div>
                      {canEditRole && role !== roleName && role && (
                        <>
                          <Notice>
                            Changes {displayName(user)} from{' '}
                            <strong>{roleName || 'no role'}</strong> to <strong>{role}</strong>.
                            Their permissions change immediately.
                          </Notice>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className={btnSecondary}
                              onClick={() => setRole(roleName)}
                            >
                              Discard
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              className={btnPrimary}
                              onClick={() => act('patch', `/directory/${user.id}/role`, { role })}
                            >
                              {busy ? (
                                <Loader2
                                  size={18}
                                  aria-hidden="true"
                                  className="animate-spin motion-reduce:animate-none"
                                />
                              ) : null}
                              Save role
                            </button>
                          </div>
                        </>
                      )}
                    </Tabs.Panel>

                    <Tabs.Panel value="access" className="space-y-4 outline-none">
                      {!can('entitlements.read') ? (
                        <p className="text-sm text-muted-foreground">
                          You do not have permission to view app access.
                        </p>
                      ) : nothingToShow ? (
                        <p className="text-sm text-muted-foreground">Loading…</p>
                      ) : detail && detail.entitlements.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No applications are registered yet.
                        </p>
                      ) : (
                        <>
                          <ul className="divide-y divide-border rounded-lg border border-border">
                            {detail?.entitlements.map((ent) => {
                              const allowed = can(
                                ent.enabled ? 'entitlements.revoke' : 'entitlements.grant'
                              )
                              const labelId = `ent-${ent.slug}`
                              return (
                                <li
                                  key={ent.slug}
                                  className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5"
                                >
                                  <div className="min-w-0">
                                    <p id={labelId} className="text-sm font-medium">
                                      {ent.name}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {ent.enabled ? 'Has access' : 'No access'}
                                    </p>
                                  </div>
                                  <ToggleSwitch
                                    checked={ent.enabled}
                                    disabled={!allowed || busy}
                                    labelledBy={labelId}
                                    label={ent.name}
                                    onCheckedChange={(next) => {
                                      if (next)
                                        act('patch', `/directory/${user.id}/entitlements`, {
                                          app: ent.slug,
                                          enabled: true,
                                        })
                                      else
                                        setPending({
                                          kind: 'revoke-app',
                                          slug: ent.slug,
                                          appName: ent.name,
                                        })
                                    }}
                                  />
                                </li>
                              )
                            })}
                          </ul>
                          <p className="text-sm text-muted-foreground">
                            Granting takes effect on the next sign-in. Revoking also ends this
                            person’s active tokens for that app.
                          </p>
                        </>
                      )}
                    </Tabs.Panel>

                    <Tabs.Panel value="sessions" className="space-y-4 outline-none">
                      {!can('sessions.read') ? (
                        <p className="text-sm text-muted-foreground">
                          You do not have permission to view sessions.
                        </p>
                      ) : nothingToShow ? (
                        <p className="text-sm text-muted-foreground">Loading…</p>
                      ) : detail && detail.sessions.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                          No active sessions.
                        </p>
                      ) : (
                        <>
                          <ul className="divide-y divide-border rounded-lg border border-border">
                            {detail?.sessions.map((s) => {
                              const label = describeAgent(s.agent)
                              return (
                                <li key={s.id} className="flex items-start gap-3 px-4 py-3">
                                  <MonitorSmartphone
                                    size={18}
                                    aria-hidden="true"
                                    className="mt-0.5 shrink-0 text-muted-foreground"
                                  />
                                  <div className="min-w-0 flex-1 text-sm">
                                    <p className="font-medium">{label}</p>
                                    <p className="text-muted-foreground">
                                      {[s.ip, s.geo].filter(Boolean).join(' · ') ||
                                        'Location unknown'}
                                    </p>
                                    <p className="text-muted-foreground">
                                      Last active <Stamp value={s.lastActive} />
                                    </p>
                                  </div>
                                  {canEditSessions && (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      aria-label={`Sign out ${label}`}
                                      onClick={() =>
                                        setPending({
                                          kind: 'revoke-session',
                                          sessionId: s.id,
                                          label,
                                        })
                                      }
                                      className={cn(btnSecondary, 'h-10 px-3')}
                                    >
                                      Sign out
                                    </button>
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                          {canEditSessions && (
                            <div className="flex justify-end">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setPending({ kind: 'revoke-all' })}
                                className={btnDanger}
                              >
                                Sign out of all devices
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </Tabs.Panel>
                  </div>
                </Tabs.Root>
              </>
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => !open && setPending(null)}
        title={copy?.title ?? ''}
        description={copy?.body}
        confirmLabel={copy?.label ?? 'Confirm'}
        destructive
        onConfirm={runPending}
      />
    </>
  )
}
