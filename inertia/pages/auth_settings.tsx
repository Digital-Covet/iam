import { useState } from 'react'
import { Head } from '@inertiajs/react'
import { ToggleSwitch } from '~/components/ui/switch'
import {
  GitBranch,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Smartphone,
  Globe,
  Fingerprint,
  type LucideIcon,
} from 'lucide-react'
import { PageHeader } from '~/components/page-header'
import { ConfirmDialog } from '~/components/directory/confirm-dialog'
import { Button } from '~/components/ui/button'
import { NumberFieldInput } from '~/components/ui/field'
import { Stamp, mutate } from '~/components/directory/shared'
import { usePermissions } from '~/hooks/use-permissions'
import { withAppShell } from '~/layouts/app-shell'
import { cn } from '~/lib/utils'

type Policy = {
  minLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireNumber: boolean
  requireSpecial: boolean
  maxAgeDays: number | null
  historyCount: number
  requireTwoFactor: boolean
  updatedAt: string | null
  updatedBy: string | null
}

type Method = { key: string; name: string; enabled: boolean; locked: boolean }

type Props = { policy: Policy; methods: Method[]; userCount: number; canSave: boolean }

type Draft = {
  minLength: number | null
  requireUppercase: boolean
  requireLowercase: boolean
  requireNumber: boolean
  requireSpecial: boolean
  expires: boolean
  maxAgeDays: number | null
  historyCount: number | null
  requireTwoFactor: boolean
}

const nf = new Intl.NumberFormat('en-US')

const METHOD_INFO: Record<string, { icon: LucideIcon; effect: string }> = {
  credential: {
    icon: KeyRound,
    effect: 'Sign in with an email address and password. Always on — it is the fallback path.',
  },
  google: { icon: Globe, effect: 'Let people sign in with their Google account.' },
  github: { icon: GitBranch, effect: 'Let people sign in with their GitHub account.' },
  oidc: {
    icon: Fingerprint,
    effect: 'Let people sign in through an external OpenID Connect provider.',
  },
  totp: {
    icon: Smartphone,
    effect:
      'Allow authenticator-app codes as a second factor. Turning it off removes the second step for everyone.',
  },
  email_otp: { icon: Mail, effect: 'Allow one-time codes sent by email as a sign-in factor.' },
}

/** Methods whose removal can strand people who rely on them. */
const RISKY_OFF = new Set(['totp', 'email_otp'])

const fromPolicy = (p: Policy): Draft => ({
  minLength: p.minLength,
  requireUppercase: p.requireUppercase,
  requireLowercase: p.requireLowercase,
  requireNumber: p.requireNumber,
  requireSpecial: p.requireSpecial,
  expires: p.maxAgeDays !== null,
  maxAgeDays: p.maxAgeDays ?? 90,
  historyCount: p.historyCount,
  requireTwoFactor: p.requireTwoFactor ?? false,
})

/** Returns a message per invalid field, mirroring the server's validator. */
function validate(d: Draft) {
  const errors: Partial<Record<'minLength' | 'maxAgeDays' | 'historyCount', string>> = {}
  const min = d.minLength
  if (min === null || !Number.isInteger(min) || min < 8 || min > 64)
    errors.minLength = 'Enter a whole number from 8 to 64.'
  if (d.expires) {
    const age = d.maxAgeDays
    if (age === null || !Number.isInteger(age) || age < 30 || age > 3650)
      errors.maxAgeDays = 'Enter a whole number of days from 30 to 3650.'
  }
  const hist = d.historyCount
  if (hist === null || !Number.isInteger(hist) || hist < 0 || hist > 24)
    errors.historyCount = 'Enter a whole number from 0 to 24.'
  return errors
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-xl border border-border bg-surface p-5 shadow-card md:p-6"
    >
      <div className="-mx-5 mb-5 border-b border-border px-5 pb-4 md:-mx-6 md:px-6">
        <h2 id={id} className="font-display text-[1.375rem] leading-tight font-medium">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

function Toggle({
  checked,
  onCheckedChange,
  disabled,
  label,
  describedBy,
}: {
  checked: boolean
  onCheckedChange: (next: boolean) => void
  disabled?: boolean
  label: string
  describedBy?: string
}) {
  return (
    <ToggleSwitch
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      label={label}
      describedBy={describedBy}
    />
  )
}

function SaveRow({
  dirty,
  saving,
  disabled,
  onDiscard,
  onSave,
  label,
}: {
  dirty: boolean
  saving: boolean
  disabled?: boolean
  onDiscard: () => void
  onSave: () => void
  label: string
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
      <p
        role="status"
        className={cn(
          'mr-auto flex items-center gap-2 text-sm',
          dirty ? 'font-medium' : 'text-muted-foreground'
        )}
      >
        {dirty && (
          <span
            aria-hidden="true"
            className="size-4 border-t-[3px] border-l-[3px] border-t-primary border-l-primary bg-primary/10"
          />
        )}
        {dirty ? 'You have unsaved changes.' : 'No unsaved changes.'}
      </p>
      <Button variant="secondary" disabled={!dirty || saving} onClick={onDiscard}>
        Discard
      </Button>
      <Button variant="primary" disabled={!dirty || saving || disabled} onClick={onSave}>
        {saving && (
          <Loader2
            size={18}
            aria-hidden="true"
            className="animate-spin motion-reduce:animate-none"
          />
        )}
        {saving ? 'Saving…' : label}
      </Button>
    </div>
  )
}

function PolicySection({ policy, editable }: { policy: Policy; editable: boolean }) {
  const [draft, setDraft] = useState<Draft>(() => fromPolicy(policy))
  const [saving, setSaving] = useState(false)
  const [showErrors, setShowErrors] = useState(false)

  // Re-sync when the server sends a fresh row (after a save).
  const [seen, setSeen] = useState(policy)
  if (seen !== policy) {
    setSeen(policy)
    setDraft(fromPolicy(policy))
    setShowErrors(false)
  }

  const base = fromPolicy(policy)
  const dirty = (Object.keys(base) as (keyof Draft)[]).some((k) => base[k] !== draft[k])
  const errors = validate(draft)
  const hasErrors = Object.keys(errors).length > 0
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  function save() {
    if (hasErrors) {
      setShowErrors(true)
      return
    }
    setSaving(true)
    mutate(
      'patch',
      '/auth-settings/policy',
      {
        minLength: draft.minLength,
        requireUppercase: draft.requireUppercase,
        requireLowercase: draft.requireLowercase,
        requireNumber: draft.requireNumber,
        requireSpecial: draft.requireSpecial,
        maxAgeDays: draft.expires ? draft.maxAgeDays : null,
        historyCount: draft.historyCount,
        requireTwoFactor: draft.requireTwoFactor,
      },
      () => setSaving(false)
    )
  }

  const rules: {
    key: 'requireUppercase' | 'requireLowercase' | 'requireNumber' | 'requireSpecial'
    label: string
  }[] = [
    { key: 'requireUppercase', label: 'Uppercase letter' },
    { key: 'requireLowercase', label: 'Lowercase letter' },
    { key: 'requireNumber', label: 'Number' },
    { key: 'requireSpecial', label: 'Special character' },
  ]

  return (
    <Section
      id="policy-heading"
      title="Password policy"
      description="Applies when someone sets or changes a password. Existing passwords are not rechecked."
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (editable && dirty) save()
        }}
      >
        <fieldset disabled={!editable || saving} className="grid gap-5 sm:grid-cols-2">
          <legend className="sr-only">Password policy</legend>

          <NumberFieldInput
            label="Minimum length"
            value={draft.minLength}
            onValueChange={(v) => set('minLength', v)}
            min={8}
            max={64}
            error={showErrors ? errors.minLength : undefined}
            help="Characters, 8 to 64."
            helpId="pp-min-help"
          />

          <NumberFieldInput
            label="Password history"
            value={draft.historyCount}
            onValueChange={(v) => set('historyCount', v)}
            min={0}
            max={24}
            error={showErrors ? errors.historyCount : undefined}
            help="Previous passwords that cannot be reused. 0 turns this off."
            helpId="pp-history-help"
          />

          <div className="sm:col-span-2">
            <p id="pp-rules" className="text-sm font-medium">
              Required character types
            </p>
            <ul
              aria-labelledby="pp-rules"
              className="mt-2 divide-y divide-border rounded-lg border border-border"
            >
              {rules.map((r) => (
                <li key={r.key} className="flex min-h-12 items-center justify-between gap-4 px-4">
                  <span id={`pp-${r.key}`} className="text-sm">
                    {r.label}
                  </span>
                  <span
                    className={cn(
                      'flex items-center gap-3 text-sm',
                      draft[r.key] ? 'font-medium text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {draft[r.key] ? 'Required' : 'Optional'}
                    <Toggle
                      checked={draft[r.key]}
                      onCheckedChange={(v) => set(r.key, v)}
                      disabled={!editable || saving}
                      label={`Require ${r.label.toLowerCase()}`}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3 sm:col-span-2">
            <div className="flex min-h-12 items-center justify-between gap-4 rounded-lg border border-border px-4">
              <div>
                <p id="pp-expire-label" className="text-sm">
                  Require periodic password change
                </p>
                <p id="pp-expire-help" className="text-sm text-muted-foreground">
                  Expiry counts from each person’s last change.
                </p>
              </div>
              <Toggle
                checked={draft.expires}
                onCheckedChange={(v) => set('expires', v)}
                disabled={!editable || saving}
                label="Require periodic password change"
                describedBy="pp-expire-help"
              />
            </div>

            {draft.expires && (
              <NumberFieldInput
                label="Change every (days)"
                value={draft.maxAgeDays}
                onValueChange={(v) => set('maxAgeDays', v)}
                min={30}
                max={3650}
                error={showErrors ? errors.maxAgeDays : undefined}
                help="30 to 3650 days."
                helpId="pp-age-help"
                className="max-w-xs"
              />
            )}
          </div>

          <div className="space-y-3 sm:col-span-2">
            <div className="flex min-h-12 items-center justify-between gap-4 rounded-lg border border-border px-4">
              <div>
                <p id="pp-2fa-label" className="text-sm">
                  Require two-factor for everyone
                </p>
                <p id="pp-2fa-help" className="text-sm text-muted-foreground">
                  People who have not set it up are sent to setup before they can continue.
                </p>
              </div>
              <Toggle
                checked={draft.requireTwoFactor}
                onCheckedChange={(v) => set('requireTwoFactor', v)}
                disabled={!editable || saving}
                label="Require two-factor for everyone"
                describedBy="pp-2fa-help"
              />
            </div>
          </div>
        </fieldset>

        {editable ? (
          <SaveRow
            dirty={dirty}
            saving={saving}
            onDiscard={() => {
              setDraft(base)
              setShowErrors(false)
            }}
            onSave={save}
            label="Save policy"
          />
        ) : null}
        <p className="mt-3 text-[0.8125rem] text-muted-foreground tabular-nums">
          {policy.updatedAt ? (
            <>
              Last updated <Stamp value={policy.updatedAt} />
              {policy.updatedBy ? ` by ${policy.updatedBy}` : ''}.
            </>
          ) : (
            'Using the default policy.'
          )}
        </p>
      </form>
    </Section>
  )
}

function MethodsSection({
  methods,
  userCount,
  editable,
}: {
  methods: Method[]
  userCount: number
  editable: boolean
}) {
  const serverState = Object.fromEntries(methods.map((m) => [m.key, m.enabled]))
  const [draft, setDraft] = useState<Record<string, boolean>>(serverState)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [seen, setSeen] = useState(methods)
  if (seen !== methods) {
    setSeen(methods)
    setDraft(serverState)
  }

  const changes = methods.filter((m) => draft[m.key] !== m.enabled)
  const dirty = changes.length > 0
  const enabledCount = methods.filter((m) => draft[m.key]).length
  const noneEnabled = enabledCount === 0
  const risky = changes.filter((m) => !draft[m.key] && RISKY_OFF.has(m.key))

  function commit() {
    setSaving(true)
    // One PATCH per method; stop at the first refusal so the page re-syncs to the server.
    const queue = [...changes]
    const next = () => {
      const m = queue.shift()
      if (!m) return setSaving(false)
      mutate('patch', `/auth-settings/methods/${m.key}`, { enabled: draft[m.key] }, (ok) =>
        ok ? next() : setSaving(false)
      )
    }
    next()
  }

  return (
    <Section
      id="methods-heading"
      title="Sign-in methods"
      description="Choose how people can authenticate. Changes take effect on the next sign-in."
    >
      <ul className="-mx-5 divide-y divide-border border-y border-border md:-mx-6">
        {methods.map((m) => {
          const info = METHOD_INFO[m.key] ?? {
            icon: ShieldCheck,
            effect: 'Additional sign-in method.',
          }
          const Icon = m.locked ? Lock : info.icon
          const on = draft[m.key]
          const changed = on !== m.enabled
          return (
            <li key={m.key} className="flex items-center gap-4 px-5 py-4 md:px-6">
              <span className="stamp grid size-10 shrink-0 place-items-center rounded-md text-primary">
                <Icon size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold">
                  {m.name}
                  <span className={cn('stamp-chip', on ? 'text-success' : 'text-muted-foreground')}>
                    {on ? 'Enabled' : 'Disabled'}
                  </span>
                  {changed && <span className="stamp-chip text-primary">Unsaved</span>}
                </p>
                <p id={`method-${m.key}`} className="mt-0.5 text-sm text-muted-foreground">
                  {info.effect}
                </p>
              </div>
              <Toggle
                checked={on}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, [m.key]: v }))}
                disabled={!editable || saving || m.locked}
                label={`${m.name} sign-in`}
                describedBy={`method-${m.key}`}
              />
            </li>
          )
        })}
      </ul>

      {noneEnabled && (
        <p role="alert" className="mt-3 text-sm text-error">
          Keep at least one sign-in method enabled.
        </p>
      )}

      {editable && (
        <SaveRow
          dirty={dirty}
          saving={saving}
          disabled={noneEnabled}
          onDiscard={() => setDraft(serverState)}
          onSave={() => (risky.length > 0 ? setConfirmOpen(true) : commit())}
          label="Save methods"
        />
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        destructive
        title="Disable sign-in methods?"
        confirmLabel="Disable and save"
        onConfirm={commit}
        description={
          <>
            You are turning off {risky.map((m) => m.name).join(' and ')}. People who rely on it (
            {nf.format(userCount)} {userCount === 1 ? 'account' : 'accounts'} in total) will need
            another method at their next sign-in.
          </>
        }
      >
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {changes.map((m) => (
            <li key={m.key}>
              {m.name}: {m.enabled ? 'Enabled' : 'Disabled'} →{' '}
              {draft[m.key] ? 'Enabled' : 'Disabled'}
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </Section>
  )
}

export default function AuthSettings({ policy, methods, userCount }: Props) {
  const { can } = usePermissions()
  const canEditPolicy = can('settings.password_policy.update')
  const canEditMethods = can('settings.auth_methods.update')
  const viewOnly = !canEditPolicy && !canEditMethods

  return (
    <>
      <Head title="Auth settings" />
      <PageHeader
        title="Auth settings"
        description="Password rules and sign-in methods for all Digital Covet apps."
      />

      {viewOnly && (
        <p
          role="note"
          className="mb-6 rounded-lg border border-info/40 bg-info/10 px-4 py-3 text-sm text-info"
        >
          You can view these settings, but cannot edit them.
        </p>
      )}

      <div className="space-y-8">
        {can('settings.password_policy.read') && (
          <PolicySection policy={policy} editable={canEditPolicy} />
        )}
        {can('settings.auth_methods.read') && (
          <MethodsSection methods={methods} userCount={userCount} editable={canEditMethods} />
        )}
      </div>
    </>
  )
}

AuthSettings.layout = withAppShell
