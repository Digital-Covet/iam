import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Field } from '@base-ui/react/field'
import { Input } from '@base-ui/react/input'
import { Head, router } from '@inertiajs/react'
import { Dialog } from '@base-ui/react/dialog'
import {
  AppWindow,
  Ban,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { ConfirmDialog } from '~/components/directory/confirm-dialog'
import { EmptyState } from '~/components/empty-state'
import { Button, buttonVariants } from '~/components/ui/button'
import { TextAreaField } from '~/components/ui/field'
import { InfoTooltip } from '~/components/ui/tooltip'
import {
  dialogBackdrop,
  fieldClass,
  focusRing,
  mutate,
  SelectField,
  CheckBox,
} from '~/components/directory/shared'
import { PageHeader } from '~/components/page-header'
import { withAppShell } from '~/layouts/app-shell'
import { cn } from '~/lib/utils'

type AuthMethod = 'client_secret_basic' | 'client_secret_post' | 'none'

type AppRecord = {
  id: string
  slug: string
  name: string
  description: string | null
  isActive: boolean
  clientId: string | null
  logoutUrl: string | null
  userCount: number
  redirectUris: string[]
  postLogoutRedirectUris: string[]
  /** Typed as string by the server; one of AuthMethod when set. */
  tokenEndpointAuthMethod: string | null
  requirePkce: boolean | null
}

type Props = {
  apps: AppRecord[]
  canRegister: boolean
  canEdit: boolean
  canDelete: boolean
  canManageClients: boolean
  rotated: { appId: string; secret: string } | null
}

type StatusFilter = 'all' | 'enabled' | 'disabled'

const nf = new Intl.NumberFormat('en-US')

const authMethodLabels: Record<AuthMethod, string> = {
  client_secret_basic: 'Client secret (HTTP Basic)',
  client_secret_post: 'Client secret (request body)',
  none: 'None — public client',
}

const authMethodOptions = (Object.keys(authMethodLabels) as AuthMethod[]).map((value) => ({
  value,
  label: authMethodLabels[value],
}))

/** Copy to the clipboard; resolves false instead of throwing so the UI never claims a false copy. */
async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function CopyButton({
  value,
  label,
  children,
  className,
}: {
  value: string
  label: string
  children?: React.ReactNode
  className?: string
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (state === 'idle') return
    const id = window.setTimeout(() => setState('idle'), 1500)
    return () => window.clearTimeout(id)
  }, [state])

  return (
    <>
      <InfoTooltip label={children ? undefined : state === 'copied' ? `${label}: copied` : label}>
        <button
          type="button"
          aria-label={children ? undefined : label}
          onClick={async () => setState((await writeClipboard(value)) ? 'copied' : 'failed')}
          className={cn(
            children
              ? buttonVariants.secondary
              : 'grid size-10 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-hover hover:text-foreground',
            focusRing,
            className
          )}
        >
          {state === 'copied' ? (
            <Check size={18} aria-hidden="true" className="text-success" />
          ) : (
            <Copy size={18} aria-hidden="true" />
          )}
          {children &&
            (state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : children)}
        </button>
      </InfoTooltip>
      <span role="status" className="sr-only">
        {state === 'copied'
          ? `${label}: copied`
          : state === 'failed'
            ? `${label}: copy failed`
            : ''}
      </span>
    </>
  )
}

function AppStatus({ active }: { active: boolean }) {
  const Icon = active ? CheckCircle2 : Ban
  return (
    <span className={cn('stamp-chip shrink-0', active ? 'text-success' : 'text-error')}>
      <Icon size={14} aria-hidden="true" />
      {active ? 'Enabled' : 'Disabled'}
    </span>
  )
}

/** Credential ticket: the single summary for an app + its OAuth client. Never shows a secret. */
function CredentialTicket({
  app,
  canEdit,
  canDelete,
  canManageClients,
  onEdit,
  onRotate,
  onDelete,
}: {
  app: AppRecord
  canEdit: boolean
  canDelete: boolean
  canManageClients: boolean
  onEdit: () => void
  onRotate: () => void
  onDelete: () => void
}) {
  const isPublic = app.tokenEndpointAuthMethod === 'none'
  const canRotate = canManageClients && app.clientId !== null && !isPublic
  const hasActions = canEdit || canRotate || canDelete

  return (
    <li
      className={cn(
        'relative flex flex-col rounded-[8px] border border-border bg-surface shadow-card',
        // Disabled apps carry a thin alert rail; enabled ones rely on the stamp.
        !app.isActive &&
          'before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:rounded-l-[8px] before:bg-error'
      )}
    >
      <article aria-labelledby={`app-${app.id}-name`} className="flex flex-1 flex-col">
        <header className="flex items-start gap-3 p-5 pb-4 pl-6">
          <span
            aria-hidden="true"
            className="stamp grid size-10 shrink-0 place-items-center rounded-md text-primary"
          >
            <AppWindow size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={`app-${app.id}-name`} className="truncate text-base font-semibold">
              {app.name}
            </h2>
            <p className="truncate text-sm text-muted-foreground">{app.description || app.slug}</p>
          </div>
          <AppStatus active={app.isActive} />
        </header>

        <div className="px-5 pl-6">
          <p className="text-xs font-semibold text-muted-foreground">Client ID</p>
          {app.clientId ? (
            <div className="mt-1 flex items-center gap-1 rounded-lg border border-border-strong bg-background pl-3">
              <code className="tabular min-w-0 flex-1 truncate text-sm" title={app.clientId}>
                {app.clientId}
              </code>
              <CopyButton value={app.clientId} label={`Client ID for ${app.name}`} />
            </div>
          ) : (
            <p className="mt-1 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
              No OAuth client yet.{' '}
              {canEdit ? 'Edit the app to create one.' : 'A superadmin can create one.'}
            </p>
          )}
        </div>

        <dl className="mx-5 mt-4 ml-6 grid grid-cols-3 border-y border-border text-sm">
          <div className="min-w-0 py-3 pr-3">
            <dt className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
              <Users size={14} aria-hidden="true" />
              App access
            </dt>
            <dd className="mt-1.5 tabular-nums">
              {app.userCount === 0 ? (
                <span className="font-medium">No users have access</span>
              ) : (
                <>
                  <span className="figure text-[1.75rem] leading-none">
                    {nf.format(app.userCount)}
                  </span>{' '}
                  <span className="text-[0.8125rem] text-muted-foreground">
                    {app.userCount === 1 ? 'user has' : 'users have'} access
                  </span>
                </>
              )}
            </dd>
          </div>
          <div className="perforated min-w-0 px-4 py-3">
            <dt className="text-[0.8125rem] text-muted-foreground">Redirect URIs</dt>
            <dd className="figure mt-1.5 text-[1.75rem] leading-none">
              {nf.format(app.redirectUris.length)}
            </dd>
          </div>
          <div className="perforated min-w-0 px-4 py-3">
            <dt className="text-[0.8125rem] text-muted-foreground">PKCE</dt>
            <dd className="mt-1.5 font-medium">
              {app.requirePkce === null ? '—' : app.requirePkce ? 'Required' : 'Optional'}
            </dd>
          </div>
        </dl>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 px-5 pl-6 text-sm">
          <div>
            <dt className="text-[0.8125rem] text-muted-foreground">Client type</dt>
            <dd>
              {app.tokenEndpointAuthMethod === null
                ? '—'
                : isPublic
                  ? 'Public (no secret)'
                  : 'Confidential'}
            </dd>
          </div>
          <div>
            <dt className="text-[0.8125rem] text-muted-foreground">Secret</dt>
            <dd>
              {app.tokenEndpointAuthMethod === null
                ? '—'
                : isPublic
                  ? 'Not used'
                  : 'Stored hashed · hidden'}
            </dd>
          </div>
          <div className="col-span-2 min-w-0">
            <dt className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
              <LogOut size={14} aria-hidden="true" />
              Logout URL
            </dt>
            <dd className="truncate font-mono text-sm" title={app.logoutUrl ?? undefined}>
              {app.logoutUrl ?? '—'}
            </dd>
          </div>
        </dl>

        {hasActions && (
          <footer className="relative mt-5 flex flex-wrap gap-2 border-t border-dashed border-border-strong px-5 py-3 pl-6">
            {/* Ticket perforation notches; decorative, cut out of the card edge. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-2 -left-2 size-4 rounded-full border border-border bg-background"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-2 -right-2 size-4 rounded-full border border-border bg-background"
            />
            {canEdit && (
              <Button variant="secondary" onClick={onEdit} className="h-10">
                <Pencil size={16} aria-hidden="true" />
                Edit
              </Button>
            )}
            {canRotate && (
              <Button variant="secondary" onClick={onRotate} className="h-10">
                <KeyRound size={16} aria-hidden="true" />
                Rotate secret
              </Button>
            )}
            {canDelete && (
              <Button
                variant="secondary"
                onClick={onDelete}
                aria-label={`Delete ${app.name}`}
                className="ml-auto h-10 text-error hover:bg-error/10 "
              >
                <Trash2 size={16} aria-hidden="true" />
                Delete
              </Button>
            )}
          </footer>
        )}
      </article>
    </li>
  )
}

type FormData = {
  slug: string
  name: string
  description: string
  isActive: boolean
  redirectUris: string
  postLogoutRedirectUris: string
  tokenEndpointAuthMethod: AuthMethod
  requirePkce: boolean
}

const emptyForm: FormData = {
  slug: '',
  name: '',
  description: '',
  isActive: true,
  redirectUris: '',
  postLogoutRedirectUris: '',
  tokenEndpointAuthMethod: 'client_secret_basic',
  requirePkce: true,
}

const toLines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

function AppFormDialog({
  open,
  onOpenChange,
  app,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = register a new app. */
  app: AppRecord | null
}) {
  const editing = app !== null
  const [form, setForm] = useState<FormData>(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState(false)

  // Seed the form each time the dialog opens (render-time, not an effect).
  const [seeded, setSeeded] = useState<string | null>(null)
  const seedKey = open ? (app?.id ?? 'new') : null
  if (seedKey !== seeded) {
    setSeeded(seedKey)
    if (seedKey) {
      setErrors({})
      setForm(
        app
          ? {
              slug: app.slug,
              name: app.name,
              description: app.description ?? '',
              isActive: app.isActive,
              redirectUris: app.redirectUris.join('\n'),
              postLogoutRedirectUris: app.postLogoutRedirectUris.join('\n'),
              tokenEndpointAuthMethod: (app.tokenEndpointAuthMethod ??
                'client_secret_basic') as AuthMethod,
              requirePkce: app.requirePkce ?? true,
            }
          : emptyForm
      )
    }
  }

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const isPublic = form.tokenEndpointAuthMethod === 'none'
  const uriError = Object.entries(errors).find(([k]) => k.startsWith('redirectUris'))?.[1]
  const logoutError = Object.entries(errors).find(([k]) =>
    k.startsWith('postLogoutRedirectUris')
  )?.[1]

  function submit(e: FormEvent) {
    e.preventDefault()
    if (processing) return
    const payload = {
      ...(editing ? {} : { slug: form.slug.trim() }),
      name: form.name.trim(),
      description: form.description.trim() || null,
      isActive: form.isActive,
      redirectUris: toLines(form.redirectUris),
      postLogoutRedirectUris: toLines(form.postLogoutRedirectUris),
      tokenEndpointAuthMethod: form.tokenEndpointAuthMethod,
      // Public clients must require PKCE; the server rejects anything else.
      requirePkce: isPublic ? true : form.requirePkce,
    }
    setProcessing(true)
    setErrors({})
    const url = editing ? `/apps/${app.id}` : '/apps'
    router[editing ? 'patch' : 'post'](url, payload, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: (page) => {
        // The server redirects back even when it refuses (e.g. a bad URI); keep the dialog open.
        if (!page.flash?.error) onOpenChange(false)
      },
      onError: (errs) => setErrors(errs),
      onFinish: () => setProcessing(false),
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className={dialogBackdrop} />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface-raised p-6 shadow-float transition-[opacity,translate] duration-180 data-ending-style:opacity-0 data-starting-style:-translate-y-[calc(50%+8px)] data-starting-style:opacity-0 motion-reduce:transition-none">
          <div className="ledger-rule flex items-start justify-between gap-3 pb-4">
            <div>
              <Dialog.Title className="text-xl leading-tight font-semibold">
                {editing ? `Edit ${app.name}` : 'Register app'}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {editing
                  ? 'Changes apply to the app and its OAuth client immediately.'
                  : 'Creates the app and its OAuth client. A confidential client’s secret is shown once.'}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close"
              className={cn(
                'grid size-10 shrink-0 place-items-center rounded-md hover:bg-hover',
                focusRing
              )}
            >
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <form onSubmit={submit} noValidate className="mt-5 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field.Root className="space-y-1.5">
                <Field.Label className="text-sm font-medium">Name</Field.Label>
                <Input
                  required
                  autoComplete="off"
                  value={form.name}
                  onValueChange={(v) => set('name', v)}
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={errors.name ? 'app-name-error' : undefined}
                  className={fieldClass}
                />
                {errors.name && (
                  <p id="app-name-error" className="text-sm text-error">
                    {errors.name}
                  </p>
                )}
              </Field.Root>
              <Field.Root className="space-y-1.5">
                <Field.Label className="text-sm font-medium">Slug</Field.Label>
                <Input
                  required
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={editing}
                  placeholder="e.g. share"
                  value={form.slug}
                  onValueChange={(v) => set('slug', v)}
                  aria-invalid={errors.slug ? true : undefined}
                  aria-describedby="app-slug-help"
                  className={cn(fieldClass, 'font-mono disabled:opacity-60')}
                />
                <p id="app-slug-help" className="text-sm text-muted-foreground">
                  {editing
                    ? 'The slug can’t be changed.'
                    : 'Lowercase letters, numbers and hyphens.'}
                </p>
                {errors.slug && <p className="text-sm text-error">{errors.slug}</p>}
              </Field.Root>
            </div>

            <Field.Root className="space-y-1.5">
              <Field.Label className="text-sm font-medium">Description (optional)</Field.Label>
              <Input
                maxLength={500}
                autoComplete="off"
                value={form.description}
                onValueChange={(v) => set('description', v)}
                className={fieldClass}
              />
            </Field.Root>

            <TextAreaField
              label="Redirect URIs"
              value={form.redirectUris}
              onValueChange={(v) => set('redirectUris', v)}
              error={uriError}
              help="One per line. https only; http is allowed for localhost."
              helpId="app-redirects-help"
              placeholder="https://share.digitalcovet.com/auth/callback"
              rows={3}
            />

            <TextAreaField
              label="Post-logout redirect URIs (optional)"
              value={form.postLogoutRedirectUris}
              onValueChange={(v) => set('postLogoutRedirectUris', v)}
              error={logoutError}
              placeholder="https://share.digitalcovet.com"
              rows={2}
            />

            <SelectField
              label="Client authentication"
              value={form.tokenEndpointAuthMethod}
              onValueChange={(v) => set('tokenEndpointAuthMethod', v as AuthMethod)}
              options={authMethodOptions}
            />

            <fieldset className="space-y-2">
              <legend className="sr-only">Options</legend>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border-strong px-3 py-2.5 text-sm">
                <CheckBox
                  checked={isPublic ? true : form.requirePkce}
                  disabled={isPublic}
                  onCheckedChange={(next) => set('requirePkce', next)}
                />
                <span>
                  <span className="font-medium">Require PKCE</span>
                  <span className="block text-muted-foreground">
                    {isPublic
                      ? 'Always on for public clients.'
                      : 'Recommended for every client, including confidential ones.'}
                  </span>
                </span>
              </label>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border-strong px-3 py-2.5 text-sm">
                <CheckBox
                  checked={form.isActive}
                  onCheckedChange={(next) => set('isActive', next)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Enabled</span>
                  <span className="block text-muted-foreground">
                    Disabling an app revokes its existing grants and blocks new sign-ins.
                  </span>
                </span>
              </label>
            </fieldset>

            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Dialog.Close className={buttonVariants.secondary}>Cancel</Dialog.Close>
              <Button
                type="submit"
                disabled={processing || !form.name.trim() || (!editing && !form.slug.trim())}
                variant="primary"
              >
                {processing ? (
                  <>
                    <Loader2
                      size={18}
                      aria-hidden="true"
                      className="animate-spin motion-reduce:animate-none"
                    />
                    Saving…
                  </>
                ) : editing ? (
                  'Save changes'
                ) : (
                  'Register app'
                )}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * One-time reveal. It can only be closed through the acknowledgement, never by
 * Escape or an outside click, so the secret is not lost by accident.
 */
function SecretRevealDialog({
  appName,
  secret,
  onDismiss,
}: {
  appName: string
  secret: string | null
  onDismiss: () => void
}) {
  // The parent keys this component by secret, so the acknowledgement resets per secret.
  const [acknowledged, setAcknowledged] = useState(false)

  return (
    <Dialog.Root
      open={secret !== null}
      disablePointerDismissal
      onOpenChange={(open, details) => {
        // Escape and focus loss are ignored until the secret is acknowledged.
        if (!open && !acknowledged) {
          details.cancel()
          return
        }
        if (!open) onDismiss()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className={dialogBackdrop} />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface-raised p-6 shadow-float transition-[opacity,translate] duration-180 data-ending-style:opacity-0 data-starting-style:-translate-y-[calc(50%+8px)] data-starting-style:opacity-0 motion-reduce:transition-none">
          <Dialog.Title className="text-xl leading-tight font-semibold">
            Client secret for {appName}
          </Dialog.Title>
          <Dialog.Description className="ledger-rule mt-1 pb-4 text-sm text-muted-foreground">
            Copy this secret into the app’s configuration now.
          </Dialog.Description>

          <div
            role="note"
            className="mt-4 flex gap-3 rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm"
          >
            <KeyRound size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
            <p>
              <span className="font-semibold text-accent">Shown only once.</span> Only a hash is
              stored, so if you leave this screen the secret can’t be shown again — you would have
              to rotate it.
            </p>
          </div>

          <div className="mt-4 flex items-center gap-1 rounded-lg border border-border bg-background pl-3">
            <code className="min-w-0 flex-1 py-2 font-mono text-sm break-all select-all">
              {secret}
            </code>
          </div>
          <div className="mt-2">
            <CopyButton value={secret ?? ''} label={`Client secret for ${appName}`}>
              Copy secret
            </CopyButton>
          </div>

          <label className="mt-5 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border-strong px-3 text-sm">
            <CheckBox checked={acknowledged} onCheckedChange={setAcknowledged} />
            I’ve saved this secret
          </label>

          <div className="mt-5 flex justify-end">
            <Dialog.Close disabled={!acknowledged} className={buttonVariants.primary}>
              Done
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default function Apps({
  apps,
  canRegister,
  canEdit,
  canDelete,
  canManageClients,
  rotated,
}: Props) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AppRecord | null>(null)
  const [rotateTarget, setRotateTarget] = useState<AppRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AppRecord | null>(null)

  // The secret arrives as a one-request flash; hold it locally so a later
  // partial reload can't drop it before the person has copied it.
  const [reveal, setReveal] = useState<{ appId: string; secret: string } | null>(null)
  const [seenSecret, setSeenSecret] = useState<string | null>(null)
  if (rotated && rotated.secret !== seenSecret) {
    setSeenSecret(rotated.secret)
    setReveal(rotated)
  }
  const revealApp = reveal ? apps.find((a) => a.id === reveal.appId) : undefined

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return apps.filter((a) => {
      if (status === 'enabled' && !a.isActive) return false
      if (status === 'disabled' && a.isActive) return false
      if (!q) return true
      return [a.name, a.slug, a.clientId ?? '', a.description ?? ''].some((v) =>
        v.toLowerCase().includes(q)
      )
    })
  }, [apps, search, status])

  const filtered = search.trim() !== '' || status !== 'all'

  function openRegister() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(app: AppRecord) {
    setEditing(app)
    setFormOpen(true)
  }

  return (
    <>
      <Head title="Applications" />
      <PageHeader
        title="Applications"
        description="Internal apps that sign in through IAM Digital Covet, and their OAuth credentials."
        actions={
          canRegister && (
            <Button variant="primary" onClick={openRegister}>
              <Plus size={18} aria-hidden="true" />
              Register app
            </Button>
          )
        }
      />

      {apps.length > 0 && (
        <form
          role="search"
          aria-label="Filter applications"
          onSubmit={(e) => e.preventDefault()}
          className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface p-4 shadow-card sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]"
        >
          <Field.Root className="space-y-1.5">
            <Field.Label className="block text-sm font-medium">Search</Field.Label>
            <div className="relative">
              <Search
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                autoComplete="off"
                spellCheck={false}
                placeholder="e.g. share or a client ID"
                value={search}
                onValueChange={setSearch}
                className={cn(fieldClass, 'pr-11 pl-10 [&::-webkit-search-cancel-button]:hidden')}
              />
              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearch('')}
                  className={cn(
                    'absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-muted-foreground hover:text-foreground',
                    focusRing
                  )}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          </Field.Root>

          <SelectField
            label="Status"
            value={status}
            onValueChange={(v) => setStatus(v as StatusFilter)}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'enabled', label: 'Enabled' },
              { value: 'disabled', label: 'Disabled' },
            ]}
          />

          <div className="flex items-end">
            <Button
              variant="secondary"
              disabled={!filtered}
              onClick={() => {
                setSearch('')
                setStatus('all')
              }}
              className="w-full sm:w-auto"
            >
              Clear filters
            </Button>
          </div>
        </form>
      )}

      {apps.length > 0 && (
        <p role="status" className="mb-3 text-sm text-muted-foreground tabular-nums">
          {visible.length === 0
            ? 'No applications match these filters.'
            : `Showing ${nf.format(visible.length)} of ${nf.format(apps.length)} ${apps.length === 1 ? 'application' : 'applications'}`}
        </p>
      )}

      {apps.length === 0 ? (
        <section className="rounded-xl border border-border bg-surface shadow-card">
          <EmptyState
            icon={AppWindow}
            title="No applications registered"
            description={
              canRegister
                ? 'Register an app to give it an OAuth client and let people sign in to it.'
                : 'Applications will appear here once a superadmin registers them.'
            }
          >
            {canRegister && (
              <Button variant="primary" onClick={openRegister}>
                <Plus size={18} aria-hidden="true" />
                Register app
              </Button>
            )}
          </EmptyState>
        </section>
      ) : visible.length === 0 ? (
        <section className="rounded-xl border border-border bg-surface shadow-card">
          <EmptyState
            icon={Search}
            title="No applications match these filters"
            description="Try a different search or remove a filter."
          >
            <Button
              variant="secondary"
              onClick={() => {
                setSearch('')
                setStatus('all')
              }}
            >
              Clear filters
            </Button>
          </EmptyState>
        </section>
      ) : (
        <ul aria-label="Applications" className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
          {visible.map((app) => (
            <CredentialTicket
              key={app.id}
              app={app}
              canEdit={canEdit}
              canDelete={canDelete}
              canManageClients={canManageClients}
              onEdit={() => openEdit(app)}
              onRotate={() => setRotateTarget(app)}
              onDelete={() => setDeleteTarget(app)}
            />
          ))}
        </ul>
      )}

      <AppFormDialog open={formOpen} onOpenChange={setFormOpen} app={editing} />

      <ConfirmDialog
        open={!!rotateTarget}
        onOpenChange={(open) => !open && setRotateTarget(null)}
        title={`Rotate the secret for ${rotateTarget?.name ?? ''}?`}
        description="A new secret is issued and shown once. The current secret stops working immediately, so update the app’s configuration straight after."
        confirmLabel="Rotate secret"
        destructive
        onConfirm={() =>
          rotateTarget && mutate('post', `/apps/${rotateTarget.id}/rotate-secret`, undefined)
        }
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? ''}?`}
        description={
          <>
            Sign-ins to this app stop immediately, its OAuth client is removed and existing grants
            are revoked.
            {deleteTarget && deleteTarget.userCount > 0 && (
              <>
                {' '}
                <strong className="font-semibold text-foreground">
                  {nf.format(deleteTarget.userCount)}{' '}
                  {deleteTarget.userCount === 1 ? 'user currently has' : 'users currently have'}{' '}
                  access.
                </strong>
              </>
            )}
          </>
        }
        confirmLabel="Delete app"
        destructive
        onConfirm={() => deleteTarget && mutate('delete', `/apps/${deleteTarget.id}`, undefined)}
      />

      <SecretRevealDialog
        key={reveal?.secret ?? 'none'}
        appName={revealApp?.name ?? 'this app'}
        secret={reveal?.secret ?? null}
        onDismiss={() => setReveal(null)}
      />
    </>
  )
}

Apps.layout = withAppShell
