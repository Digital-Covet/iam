import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Head, router } from '@inertiajs/react'
import { Field } from '@base-ui/react/field'
import { Input } from '@base-ui/react/input'
import { Tabs } from '@base-ui/react/tabs'
import {
  AppWindow,
  Camera,
  Check,
  Circle,
  Eye,
  EyeOff,
  KeyRound,
  Laptop,
  Loader2,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { ConfirmDialog } from '~/components/directory/confirm-dialog'
import { Button } from '~/components/ui/button'
import { describeAgent, fieldClass, focusRing, mutate, Stamp } from '~/components/directory/shared'
import { PageHeader } from '~/components/page-header'
import { withAppShell } from '~/layouts/app-shell'
import { cn } from '~/lib/utils'

type Profile = {
  id: string
  name: string | null
  email: string
  initials: string
  image: string | null
  roleName: string
}

type SessionRow = {
  id: string
  ip: string | null
  agent: string | null
  lastActive: string | null
  created: string | null
  current: boolean
}

type ConnectedApp = {
  id: string
  slug: string
  name: string
  description: string | null
  enabled: boolean
  claim: string
}

type PasswordPolicy = {
  minLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireNumber: boolean
  requireSpecial: boolean
  historyCount: number
  expiresAt: string | null
  daysLeft: number | null
}

type Props = {
  profile: Profile
  sessions: SessionRow[]
  apps: ConnectedApp[]
  twoFactor: { enabled: boolean; backupCodesRemaining: number }
  passwordPolicy: PasswordPolicy
  storageConfigured: boolean
}

type SectionId = 'profile' | 'password' | 'sessions' | 'two-factor' | 'apps'

const sections: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'password', label: 'Password', icon: KeyRound },
  { id: 'sessions', label: 'Sessions', icon: Laptop },
  { id: 'two-factor', label: 'Two-factor', icon: ShieldCheck },
  { id: 'apps', label: 'Connected apps', icon: AppWindow },
]

const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const nf = new Intl.NumberFormat('en-US')

/** Desktop gets a vertical section list; below 1024px it becomes a scrollable tab row. */
function useIsDesktop() {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia('(min-width: 1024px)')
      mq.addEventListener('change', notify)
      return () => mq.removeEventListener('change', notify)
    },
    () => window.matchMedia('(min-width: 1024px)').matches,
    () => true
  )
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-surface shadow-card">
      <header className="border-b border-border px-5 py-4 sm:px-6">
        <h2 className="font-display text-[1.375rem] leading-tight font-medium">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </header>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  )
}

function Spinner() {
  return (
    <Loader2 size={18} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
  )
}

function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null
  return (
    <p id={id} className="text-sm text-error">
      {children}
    </p>
  )
}

/* ---------------------------------- Profile --------------------------------- */

function AvatarPreview({
  profile,
  src,
  size,
}: {
  profile: Profile
  src: string | null
  size: number
}) {
  const [broken, setBroken] = useState(false)
  const box = { width: size, height: size }
  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setBroken(true)}
        style={box}
        className="stamp shrink-0 rounded-lg object-contain p-1"
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...box, fontSize: size / 3 }}
      className="stamp grid shrink-0 place-items-center rounded-lg font-semibold text-primary"
    >
      {profile.initials}
    </span>
  )
}

function ProfileSection({
  profile,
  storageConfigured,
}: {
  profile: Profile
  storageConfigured: boolean
}) {
  const [name, setName] = useState(profile.name ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const trimmed = name.trim()
  const nameChanged = trimmed !== (profile.name ?? '')
  const dirty = nameChanged || file !== null
  const nameInvalid = trimmed.length > 0 && trimmed.length < 2

  function pick(next: File | undefined) {
    setFileError(null)
    if (!next) return
    if (!AVATAR_TYPES.includes(next.type)) {
      setFileError('Use a JPG, PNG or WebP image.')
      return
    }
    if (next.size > MAX_AVATAR_BYTES) {
      setFileError('That photo is over 2MB. Choose a smaller one.')
      return
    }
    setFile(next)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!dirty || processing || nameInvalid) return
    setProcessing(true)
    setErrors({})
    router.patch(
      '/account-settings/profile',
      {
        ...(nameChanged ? { name: trimmed || null } : {}),
        ...(file ? { avatar: file } : {}),
      },
      {
        forceFormData: true,
        preserveScroll: true,
        preserveState: true,
        onSuccess: (page) => {
          if (!(page.flash as { error?: string } | undefined)?.error) setFile(null)
        },
        onError: (errs) => setErrors(errs),
        onFinish: () => setProcessing(false),
      }
    )
  }

  const nameError = errors.name ?? (nameInvalid ? 'Use at least 2 characters.' : undefined)

  return (
    <SectionCard title="Profile" description="How you appear to other people in Digital Covet.">
      <form onSubmit={submit} noValidate className="space-y-6">
        <div className="flex flex-wrap items-center gap-5">
          <AvatarPreview profile={profile} src={preview ?? profile.image} size={72} />
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap gap-2">
              <input
                ref={inputRef}
                id="avatar"
                type="file"
                accept={AVATAR_TYPES.join(',')}
                disabled={!storageConfigured}
                onChange={(e) => {
                  pick(e.target.files?.[0])
                  e.target.value = ''
                }}
                aria-describedby="avatar-help"
                className="sr-only"
              />
              <Button
                variant="secondary"
                disabled={!storageConfigured || processing}
                onClick={() => inputRef.current?.click()}
              >
                <Camera size={16} aria-hidden="true" />
                {profile.image || file ? 'Change photo' : 'Upload photo'}
              </Button>
              {file && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setFile(null)
                    setFileError(null)
                  }}
                >
                  Remove selection
                </Button>
              )}
            </div>
            <p id="avatar-help" className="text-sm text-muted-foreground">
              {storageConfigured
                ? 'JPG, PNG or WebP, up to 2MB.'
                : 'Photo upload isn’t set up yet. Your initials are shown instead.'}
            </p>
            {file && !fileError && (
              <p className="truncate text-sm" role="status">
                Ready to save: <span className="font-medium">{file.name}</span>
              </p>
            )}
            <FieldError id="avatar-error">{fileError}</FieldError>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field.Root className="space-y-1.5">
            <Field.Label className="text-sm font-medium">Full name</Field.Label>
            <Input
              autoComplete="name"
              maxLength={100}
              value={name}
              onValueChange={setName}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? 'profile-name-error' : undefined}
              className={fieldClass}
            />
            <FieldError id="profile-name-error">{nameError}</FieldError>
          </Field.Root>
          <Field.Root className="space-y-1.5">
            <Field.Label className="text-sm font-medium">Email</Field.Label>
            <Input
              value={profile.email}
              readOnly
              aria-describedby="profile-email-help"
              className={cn(fieldClass, 'bg-background text-muted-foreground')}
            />
            <p id="profile-email-help" className="text-sm text-muted-foreground">
              Email changes go through an admin.
            </p>
          </Field.Root>
        </div>

        <dl className="text-sm">
          <dt className="text-muted-foreground">Role</dt>
          <dd className="mt-1">
            <span className="rounded-md bg-hover px-2 py-0.5 text-[0.8125rem] font-medium">
              {profile.roleName}
            </span>
          </dd>
        </dl>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button
            variant="secondary"
            disabled={!dirty || processing}
            onClick={() => {
              setName(profile.name ?? '')
              setFile(null)
              setFileError(null)
              setErrors({})
            }}
          >
            Discard
          </Button>
          <Button type="submit" variant="primary" disabled={!dirty || processing || nameInvalid}>
            {processing ? (
              <>
                <Spinner />
                Saving…
              </>
            ) : (
              'Save profile'
            )}
          </Button>
        </div>
      </form>
    </SectionCard>
  )
}

/* --------------------------------- Password --------------------------------- */

function rulesFor(policy: PasswordPolicy) {
  const rules: { label: string; test: (v: string) => boolean }[] = [
    { label: `At least ${policy.minLength} characters`, test: (v) => v.length >= policy.minLength },
  ]
  if (policy.requireUppercase)
    rules.push({ label: 'One capital letter (A–Z)', test: (v) => /[A-Z]/.test(v) })
  if (policy.requireLowercase)
    rules.push({ label: 'One small letter (a–z)', test: (v) => /[a-z]/.test(v) })
  if (policy.requireNumber) rules.push({ label: 'One number (0–9)', test: (v) => /[0-9]/.test(v) })
  if (policy.requireSpecial)
    rules.push({ label: 'One symbol (for example ! or #)', test: (v) => /[^A-Za-z0-9]/.test(v) })
  return rules
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  describedBy,
  invalid,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete: 'current-password' | 'new-password'
  describedBy?: string
  invalid?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <Field.Root className="space-y-1.5">
      <Field.Label className="text-sm font-medium">{label}</Field.Label>
      <div className="relative">
        <Input
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onValueChange={onChange}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
          className={cn(fieldClass, 'pr-12')}
        />
        <button
          type="button"
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={show}
          aria-controls={id}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-muted-foreground transition-colors duration-140 hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
        >
          {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    </Field.Root>
  )
}

function PasswordSection({ policy }: { policy: PasswordPolicy }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState(false)

  const results = useMemo(
    () => rulesFor(policy).map((r) => ({ ...r, met: r.test(next) })),
    [policy, next]
  )
  const metCount = results.filter((r) => r.met).length
  const allMet = metCount === results.length
  const mismatch = confirm.length > 0 && next !== confirm
  const canSubmit = current.length > 0 && allMet && next === confirm && !processing

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setProcessing(true)
    setErrors({})
    router.patch(
      '/account-settings/password',
      { currentPassword: current, newPassword: next, newPasswordConfirmation: confirm },
      {
        preserveScroll: true,
        preserveState: true,
        // The server redirects back even when it refuses (wrong current password, reused
        // password); the toaster shows why. Clear the fields either way so nothing lingers.
        onSuccess: () => {
          setCurrent('')
          setNext('')
          setConfirm('')
        },
        onError: (errs) => setErrors(errs),
        onFinish: () => setProcessing(false),
      }
    )
  }

  const expiry =
    policy.daysLeft === null
      ? 'Your password doesn’t expire.'
      : policy.daysLeft <= 0
        ? 'Your password has expired. Change it now.'
        : `Your password expires in ${nf.format(policy.daysLeft)} ${policy.daysLeft === 1 ? 'day' : 'days'}.`
  const expirySoon = policy.daysLeft !== null && policy.daysLeft <= 14

  return (
    <SectionCard title="Password" description="Choose a password you don’t use anywhere else.">
      <p
        className={cn(
          'mb-5 flex items-center gap-2 text-sm',
          expirySoon ? 'font-medium text-warning' : 'text-muted-foreground'
        )}
      >
        {expirySoon && <ShieldAlert size={16} aria-hidden="true" />}
        {expiry}
        {policy.historyCount > 0 &&
          ` You can’t reuse your last ${nf.format(policy.historyCount)} ${policy.historyCount === 1 ? 'password' : 'passwords'}.`}
      </p>

      <form onSubmit={submit} noValidate className="max-w-md space-y-5">
        <PasswordField
          id="current-password"
          label="Current password"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
          invalid={Boolean(errors.currentPassword)}
          describedBy={errors.currentPassword ? 'current-password-error' : undefined}
        />
        <FieldError id="current-password-error">{errors.currentPassword}</FieldError>

        <PasswordField
          id="new-password"
          label="New password"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          describedBy="new-password-rules"
          invalid={Boolean(errors.newPassword)}
        />

        {/* Requirements are text + icon, never colour alone. */}
        <div id="new-password-rules" className="-mt-2 space-y-2.5">
          <div className="flex items-center gap-3">
            <div
              role="progressbar"
              aria-label="Requirements met"
              aria-valuemin={0}
              aria-valuemax={results.length}
              aria-valuenow={metCount}
              className="flex h-1.5 flex-1 gap-1"
            >
              {results.map((r, i) => (
                <span
                  key={r.label}
                  className={cn(
                    'h-full flex-1 rounded-full transition-colors duration-140 motion-reduce:transition-none',
                    i < metCount ? (allMet ? 'bg-success' : 'bg-primary') : 'bg-border'
                  )}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {metCount} of {results.length} met
            </span>
          </div>
          <ul className="space-y-1 text-sm">
            {results.map((r) => (
              <li
                key={r.label}
                className={cn(
                  'flex items-center gap-2',
                  r.met ? 'text-success' : 'text-muted-foreground'
                )}
              >
                {r.met ? (
                  <Check size={16} aria-hidden="true" />
                ) : (
                  <Circle size={16} aria-hidden="true" />
                )}
                <span>
                  {r.label}
                  <span className="sr-only">{r.met ? ' (met)' : ' (not met)'}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <FieldError id="new-password-error">{errors.newPassword}</FieldError>

        <PasswordField
          id="confirm-password"
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          invalid={mismatch || Boolean(errors.newPasswordConfirmation)}
          describedBy={mismatch ? 'confirm-password-error' : undefined}
        />
        <FieldError id="confirm-password-error">
          {mismatch ? 'Passwords don’t match.' : errors.newPasswordConfirmation}
        </FieldError>

        <div className="flex justify-end border-t border-border pt-4">
          <Button type="submit" variant="primary" disabled={!canSubmit}>
            {processing ? (
              <>
                <Spinner />
                Saving…
              </>
            ) : (
              'Change password'
            )}
          </Button>
        </div>
      </form>
    </SectionCard>
  )
}

/* --------------------------------- Sessions --------------------------------- */

function SessionsSection({ sessions }: { sessions: SessionRow[] }) {
  const [target, setTarget] = useState<SessionRow | null>(null)

  return (
    <SectionCard
      title="Sessions"
      description="Devices currently signed in to your account. Sign out any you don’t recognise."
    >
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active sessions.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {sessions.map((s) => {
            const mobile = /Android|iPhone|iPad|Mobile/.test(s.agent ?? '')
            const Icon = mobile ? Smartphone : Laptop
            const device = describeAgent(s.agent)
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
                <span
                  aria-hidden="true"
                  className="stamp grid size-10 shrink-0 place-items-center rounded-md text-primary"
                >
                  <Icon size={20} />
                </span>
                <div className="min-w-0 flex-1 basis-56">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {device}
                    {s.current && (
                      <span className="stamp-chip text-success">
                        <Check size={14} aria-hidden="true" />
                        This device
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-mono">{s.ip ?? 'Unknown IP'}</span>
                    {' · Last active '}
                    <Stamp value={s.lastActive} />
                    {' · Signed in '}
                    <Stamp value={s.created} />
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setTarget(s)}
                  aria-label={`${s.current ? 'Sign out' : 'Revoke'} ${device}, last active ${s.lastActive ? new Date(s.lastActive).toLocaleString('en-GB') : 'unknown'}`}
                  className="h-10"
                >
                  {s.current ? (
                    <>
                      <LogOut size={16} aria-hidden="true" />
                      Sign out
                    </>
                  ) : (
                    'Revoke'
                  )}
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
        title={target?.current ? 'Sign out of this device?' : 'Revoke this session?'}
        description={
          target?.current
            ? 'This is the device you’re using now. You’ll be signed out and taken to the sign-in page.'
            : `${describeAgent(target?.agent ?? null)} will be signed out straight away.`
        }
        confirmLabel={target?.current ? 'Sign out' : 'Revoke session'}
        destructive
        onConfirm={() =>
          target && mutate('delete', `/account-settings/sessions/${target.id}`, undefined)
        }
      />
    </SectionCard>
  )
}

/* -------------------------------- Two-factor -------------------------------- */

function TwoFactorSection({ twoFactor }: { twoFactor: Props['twoFactor'] }) {
  const [regenCode, setRegenCode] = useState('')
  const [disablePassword, setDisablePassword] = useState('')
  const [disableSecond, setDisableSecond] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)
  const low = twoFactor.enabled && twoFactor.backupCodesRemaining <= 2
  const Icon = twoFactor.enabled ? ShieldCheck : ShieldOff

  return (
    <SectionCard
      title="Two-factor authentication"
      description="Require a code from your authenticator app each time you sign in."
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn('stamp-chip', twoFactor.enabled ? 'text-success' : 'text-warning')}>
          <Icon size={14} aria-hidden="true" />
          {twoFactor.enabled ? 'On' : 'Off'}
        </span>
        <p className="text-sm text-muted-foreground">
          {twoFactor.enabled
            ? 'Your sign-in needs a second step.'
            : 'Your account is protected by your password only.'}
        </p>
      </div>

      {twoFactor.enabled ? (
        <div className="mt-5 space-y-4">
          <dl className="text-sm">
            <dt className="text-muted-foreground">Backup codes remaining</dt>
            <dd className={cn('font-medium tabular-nums', low && 'text-warning')}>
              {nf.format(twoFactor.backupCodesRemaining)}
              {low && (twoFactor.backupCodesRemaining === 0 ? ' — none left' : ' — running low')}
            </dd>
          </dl>
          <p className="max-w-prose text-sm text-muted-foreground">
            Backup codes let you sign in if you lose your authenticator app. Each works once.
            Generating new codes replaces all of the old ones. Enter a current authenticator code to
            confirm.
          </p>
          <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
            Generate new backup codes
          </Button>
          <div>
            <Button variant="secondary" onClick={() => setDisableOpen(true)}>
              Turn off two-factor
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <Button variant="primary" onClick={() => router.visit('/setup-2fa')}>
            Set up two-factor
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Generate new backup codes?"
        description="Your current backup codes stop working immediately. Enter a current authenticator code, then confirm. The new codes are shown once."
        confirmLabel="Generate codes"
        destructive
        onConfirm={() =>
          regenCode.trim() && mutate('post', '/setup-2fa/regenerate', { code: regenCode.trim() })
        }
      />
      <ConfirmDialog
        open={disableOpen}
        onOpenChange={setDisableOpen}
        title="Turn off two-factor?"
        description="Your password alone will sign you in. Enter your password and a current code or backup code."
        confirmLabel="Turn off"
        destructive
        onConfirm={() =>
          disablePassword &&
          disableSecond.trim() &&
          mutate('post', '/setup-2fa/disable', {
            currentPassword: disablePassword,
            ...(disableSecond.includes('-') || disableSecond.length > 6
              ? { backupCode: disableSecond.trim() }
              : { code: disableSecond.trim() }),
          })
        }
      />
      {(confirmOpen || disableOpen) && (
        <div className="mt-4 grid max-w-md gap-3">
          {confirmOpen && (
            <Field.Root className="space-y-1.5">
              <Field.Label className="text-sm font-medium">Authenticator code</Field.Label>
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={regenCode}
                onValueChange={(v) => setRegenCode(v.replace(/\D/g, '').slice(0, 6))}
                className={fieldClass}
              />
            </Field.Root>
          )}
          {disableOpen && (
            <>
              <Field.Root className="space-y-1.5">
                <Field.Label className="text-sm font-medium">Current password</Field.Label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={disablePassword}
                  onValueChange={setDisablePassword}
                  className={fieldClass}
                />
              </Field.Root>
              <Field.Root className="space-y-1.5">
                <Field.Label className="text-sm font-medium">
                  Authenticator or backup code
                </Field.Label>
                <Input
                  autoComplete="off"
                  value={disableSecond}
                  onValueChange={setDisableSecond}
                  className={fieldClass}
                />
              </Field.Root>
            </>
          )}
        </div>
      )}
    </SectionCard>
  )
}

/* ------------------------------- Connected apps ------------------------------ */

function AppsSection({ apps }: { apps: ConnectedApp[] }) {
  const [target, setTarget] = useState<ConnectedApp | null>(null)

  return (
    <SectionCard
      title="Connected apps"
      description="Internal apps you can sign in to. You can remove your own access; only an admin can grant it."
    >
      {apps.length === 0 ? (
        <p className="text-sm text-muted-foreground">No apps are available yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {apps.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
              <span
                aria-hidden="true"
                className="stamp grid size-10 shrink-0 place-items-center rounded-md text-primary"
              >
                <AppWindow size={20} />
              </span>
              <div className="min-w-0 flex-1 basis-56">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {a.name}
                  <span
                    className={cn(
                      'stamp-chip',
                      a.enabled ? 'text-success' : 'text-muted-foreground'
                    )}
                  >
                    {a.enabled && <Check size={14} aria-hidden="true" />}
                    {a.enabled ? 'Access granted' : 'No access'}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {a.description ||
                    (a.enabled ? 'Shares your identity and access.' : 'Ask an admin for access.')}
                </p>
                {a.enabled && (
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{a.claim}</p>
                )}
              </div>
              {a.enabled && (
                <Button
                  variant="secondary"
                  onClick={() => setTarget(a)}
                  aria-label={`Remove my access to ${a.name}`}
                  className="h-10 text-error hover:bg-error/10 "
                >
                  Remove access
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
        title={`Remove your access to ${target?.name ?? 'this app'}?`}
        description="You’ll be signed out of the app and it loses access to your account. Only an admin can give your access back."
        confirmLabel="Remove access"
        destructive
        onConfirm={() =>
          target && mutate('patch', `/account-settings/apps/${target.slug}`, { enabled: false })
        }
      />
    </SectionCard>
  )
}

/* ----------------------------------- Page ----------------------------------- */

export default function AccountSettings({
  profile,
  sessions,
  apps,
  twoFactor,
  passwordPolicy,
  storageConfigured,
}: Props) {
  const [section, setSection] = useState<SectionId>('profile')
  const desktop = useIsDesktop()

  return (
    <>
      <Head title="Account settings" />
      <PageHeader
        title="Account settings"
        description="Manage your profile and how your account is secured."
      />

      <Tabs.Root
        value={section}
        onValueChange={(v) => setSection(v as SectionId)}
        orientation={desktop ? 'vertical' : 'horizontal'}
        className="grid items-start gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)]"
      >
        <Tabs.List
          aria-label="Account settings sections"
          className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
        >
          {sections.map(({ id, label, icon: Icon }) => (
            <Tabs.Tab
              key={id}
              value={id}
              className={cn(
                'flex h-11 shrink-0 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm whitespace-nowrap text-foreground transition-colors duration-140 hover:bg-hover motion-reduce:transition-none lg:w-full',
                'data-active:bg-surface data-active:font-medium data-active:text-primary data-active:shadow-[inset_0_-3px_0_var(--primary)] lg:data-active:shadow-[inset_3px_0_0_var(--primary)]',
                focusRing
              )}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <div className="min-w-0">
          <Tabs.Panel value="profile" className={focusRing}>
            <ProfileSection profile={profile} storageConfigured={storageConfigured} />
          </Tabs.Panel>
          <Tabs.Panel value="password" className={focusRing}>
            <PasswordSection policy={passwordPolicy} />
          </Tabs.Panel>
          <Tabs.Panel value="sessions" className={focusRing}>
            <SessionsSection sessions={sessions} />
          </Tabs.Panel>
          <Tabs.Panel value="two-factor" className={focusRing}>
            <TwoFactorSection twoFactor={twoFactor} />
          </Tabs.Panel>
          <Tabs.Panel value="apps" className={focusRing}>
            <AppsSection apps={apps} />
          </Tabs.Panel>
        </div>
      </Tabs.Root>
    </>
  )
}

AccountSettings.layout = withAppShell
