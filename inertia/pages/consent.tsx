import { useEffect, useRef, useState } from 'react'
import { Head, useForm, usePage } from '@inertiajs/react'
import {
  AlertCircle,
  AppWindow,
  BadgeCheck,
  Check,
  Fingerprint,
  KeyRound,
  Loader2,
  LockKeyhole,
  RefreshCw,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { IdentitySeal } from '~/components/identity-seal'
import { cn } from '~/lib/utils'

type Scope = { key: string; label: string; description: string }

type Props =
  | { invalid: true; invalidReason?: string }
  | { noAccess: true; appName: string }
  | {
      requestId: string
      appName: string
      appSlug: string
      appDescription?: string | null
      redirectHost: string
      scopes: Scope[]
      subject: { name: string | null; email: string; initials: string }
      alreadyGranted: boolean
    }

const scopeIcons: Record<string, LucideIcon> = {
  openid: Fingerprint,
  profile: UserRound,
  offline_access: RefreshCw,
  entitlements: KeyRound,
  roles: BadgeCheck,
}

const primaryButton =
  'flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-140 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none'

const secondaryButton =
  'flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-sm font-semibold text-foreground transition-colors duration-140 hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none'

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <Head title={title} />
      <div className="grid min-h-dvh place-items-center bg-background px-4 py-10 text-foreground">
        <main className="w-full max-w-160 sm:rounded-xl sm:border sm:border-border sm:bg-surface sm:p-8 sm:shadow-float">
          <div className="mb-6 flex items-center gap-3">
            <IdentitySeal size={32} />
            <span className="text-sm font-semibold">IAM Digital Covet</span>
          </div>
          {children}
        </main>
      </div>
    </>
  )
}

function StateCard({
  icon: Icon,
  heading,
  children,
}: {
  icon: LucideIcon
  heading: string
  children: React.ReactNode
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => headingRef.current?.focus(), [])
  return (
    <section>
      <Icon size={24} aria-hidden="true" className="mb-3 text-muted-foreground" />
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl leading-tight font-semibold outline-none"
      >
        {heading}
      </h1>
      <div className="mt-2 space-y-3 text-sm text-muted-foreground">{children}</div>
    </section>
  )
}

export default function Consent(props: Props) {
  if ('invalid' in props) {
    return (
      <Frame title="Request unavailable">
        <StateCard icon={AlertCircle} heading="This request can't be completed">
          <p>{props.invalidReason ?? 'This authorization request is no longer valid.'}</p>
          <p>Return to the app and start sign-in again. No access was granted.</p>
        </StateCard>
      </Frame>
    )
  }

  if ('noAccess' in props) {
    return (
      <Frame title="No access">
        <StateCard icon={LockKeyhole} heading={`You don't have access to ${props.appName}`}>
          <p>Your account has not been given access to this app, so nothing was shared.</p>
          <p>Ask an administrator to grant you access, then try again.</p>
        </StateCard>
      </Frame>
    )
  }

  return <ConsentRequest {...props} />
}

function ConsentRequest({
  requestId,
  appName,
  appSlug,
  appDescription,
  redirectHost,
  scopes,
  subject,
  alreadyGranted,
}: Extract<Props, { requestId: string }>) {
  const { flash } = usePage()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [decision, setDecision] = useState<'approve' | 'deny' | null>(null)
  const { post, processing, errors } = useForm({ requestId })
  const error = flash?.error ?? errors.requestId

  useEffect(() => headingRef.current?.focus(), [])

  // Single submission: `processing` stays true until the server responds, and the
  // external redirect (409 location) leaves the page, so a second click can't fire.
  function decide(kind: 'approve' | 'deny') {
    if (processing) return
    setDecision(kind)
    post(`/consent/${kind}`, { onError: () => setDecision(null) })
  }

  return (
    <Frame title={`Authorize ${appName}`}>
      <header className="ledger-rule mb-6 pb-5">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl leading-tight font-semibold outline-none"
        >
          Authorize {appName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {appName} is asking to sign you in. Review what it will receive.
        </p>
      </header>

      <div role="alert" aria-live="assertive">
        {error && (
          <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-error/40 bg-error/10 px-3 py-2.5 text-sm text-error">
            <AlertCircle size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </div>

      {/* Credential-ticket edge: 3px status rail, 8px radius */}
      <section
        aria-label="Requesting application"
        className="relative flex items-center gap-4 overflow-hidden rounded-lg border border-border bg-surface py-4 pr-4 pl-5 before:absolute before:inset-y-0 before:left-0 before:w-0.75 before:bg-primary"
      >
        <span
          aria-hidden="true"
          className="grid size-12 shrink-0 place-items-center rounded-lg border border-border bg-background text-muted-foreground"
        >
          <AppWindow size={24} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{appName}</p>
          {appDescription && (
            <p className="mt-0.5 text-sm text-muted-foreground">{appDescription}</p>
          )}
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
            {appSlug} · returns to {redirectHost}
          </p>
        </div>
      </section>

      <section aria-label="Signed-in account" className="mt-4 flex items-center gap-3 px-1">
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
        >
          {subject.initials}
        </span>
        <p className="min-w-0 text-sm">
          <span className="text-muted-foreground">Signed in as </span>
          <span className="font-medium break-all">{subject.name ?? subject.email}</span>
          {subject.name && (
            <span className="block truncate text-muted-foreground">{subject.email}</span>
          )}
        </p>
      </section>

      {alreadyGranted && (
        <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-info/40 bg-info/10 px-3 py-2.5 text-sm text-info">
          <BadgeCheck size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
          <p>You've approved {appName} before. Review this request to continue.</p>
        </div>
      )}

      <section className="mt-6" aria-labelledby="scope-heading">
        <h2 id="scope-heading" className="mb-2 text-sm font-semibold">
          {appName} will be able to
        </h2>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {scopes.map((scope) => {
            const Icon = scopeIcons[scope.key] ?? KeyRound
            return (
              <li key={scope.key} className="flex items-start gap-3 px-4 py-3">
                <Icon
                  size={18}
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-muted-foreground"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{scope.label}</p>
                  <p className="text-sm text-muted-foreground">{scope.description}</p>
                </div>
              </li>
            )
          })}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          You can review connected apps later in Account settings.
        </p>
      </section>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row">
        <button
          type="button"
          disabled={processing}
          onClick={() => decide('deny')}
          className={secondaryButton}
        >
          {processing && decision === 'deny' ? (
            <>
              <Loader2
                size={18}
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
              Denying…
            </>
          ) : (
            'Deny access'
          )}
        </button>
        <button
          type="button"
          disabled={processing}
          onClick={() => decide('approve')}
          className={cn(primaryButton)}
        >
          {processing && decision === 'approve' ? (
            <>
              <Loader2
                size={18}
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
              Approving…
            </>
          ) : (
            <>
              <Check size={18} aria-hidden="true" />
              Approve access
            </>
          )}
        </button>
      </div>
    </Frame>
  )
}
