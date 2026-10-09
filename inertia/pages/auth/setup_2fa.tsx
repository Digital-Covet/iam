import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CheckBox } from '~/components/directory/shared'
import { Field } from '@base-ui/react/field'
import { Input } from '@base-ui/react/input'
import { Head, Link, useForm, usePage } from '@inertiajs/react'
import { Check, Copy, Download, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react'
import { AuthShell } from '~/components/auth/auth-shell'
import {
  AuthAlert,
  authFieldClass,
  authLinkClass,
  authSubmitClass,
} from '~/components/auth/auth-ui'
import { cn } from '~/lib/utils'

type Props = {
  alreadyEnabled: boolean
  email: string
  secret?: string
  secretGroups?: string
  otpauthUrl?: string
  qrDataUrl?: string
  confirmed?: boolean
  backupCodes?: string[]
  regenerated?: boolean
}

const secondaryBtn =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-sm font-medium transition-colors duration-140 hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none'

/** Copy with a 1.5s "Copied" state; never claims success if the clipboard refuses. */
function CopyButton({
  text,
  label,
  className,
}: {
  text: string
  label: string
  className?: string
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
    } catch {
      setState('failed')
    }
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 1500)
  }

  return (
    <>
      <button type="button" onClick={copy} className={cn(secondaryBtn, className)}>
        {state === 'copied' ? (
          <Check size={16} aria-hidden="true" />
        ) : (
          <Copy size={16} aria-hidden="true" />
        )}
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label}
      </button>
      <span role="status" className="sr-only">
        {state === 'copied' ? `${label}: copied` : state === 'failed' ? 'Could not copy' : ''}
      </span>
    </>
  )
}

function Frame({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <AuthShell eyebrow="Two-factor" title={title} description={description} width="lg">
      {children}
    </AuthShell>
  )
}

function Enroll({ email, secret, secretGroups, qrDataUrl }: Props) {
  const { flash } = usePage()
  const { data, setData, post, processing, errors } = useForm({ code: '', currentPassword: '' })
  const codeRef = useRef<HTMLInputElement>(null)
  const error = errors.code ?? errors.currentPassword ?? flash?.error

  // Only the code is cleared on a miss; the QR and secret stay put.
  useEffect(() => {
    if (error) {
      setData('code', '')
      codeRef.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash, errors])

  function submit(e: FormEvent) {
    e.preventDefault()
    if (processing || data.code.length < 6 || !data.currentPassword) return
    post('/setup-2fa')
  }

  return (
    <Frame
      title="Set up two-factor authentication"
      description={`Add a second step to sign-in for ${email}.`}
    >
      <ol className="space-y-6">
        <li>
          <h2 className="mb-3 text-base font-semibold">
            <span className="mr-2 text-muted-foreground tabular-nums">1.</span>
            Scan with your authenticator app
          </h2>
          <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-start">
            {/* White tile keeps the QR scannable in dark mode. */}
            <div className="shrink-0 rounded-lg border border-border bg-white p-2 shadow-card">
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  width={176}
                  height={176}
                  alt={`QR code to add ${email} to your authenticator app`}
                  className="size-44"
                />
              )}
            </div>
            <div className="min-w-0 space-y-2 text-sm">
              <p className="text-muted-foreground">Can’t scan? Enter this key manually:</p>
              <p
                className="rounded-md border border-border bg-surface px-2.5 py-2 font-mono text-sm tracking-wider break-all select-all"
                aria-label="Setup key"
              >
                {secretGroups}
              </p>
              {secret && <CopyButton text={secret} label="Copy key" />}
            </div>
          </div>
        </li>

        <li>
          <h2 className="mb-3 text-base font-semibold">
            <span className="mr-2 text-muted-foreground tabular-nums">2.</span>
            Enter the 6-digit code
          </h2>

          <div role="alert" aria-live="assertive">
            {error && (
              <AuthAlert className="mb-4">
                <p>{error}</p>
              </AuthAlert>
            )}
          </div>

          <form onSubmit={submit} noValidate className="space-y-4">
            <Field.Root className="space-y-1.5">
              <Field.Label className="text-sm font-medium">Current password</Field.Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                value={data.currentPassword}
                onValueChange={(v) => setData('currentPassword', v)}
                className={cn(authFieldClass, 'h-12')}
              />
            </Field.Root>
            <Field.Root className="space-y-1.5">
              <Field.Label className="text-sm font-medium">Authentication code</Field.Label>
              <Input
                ref={codeRef}
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="[0-9]*"
                required
                placeholder="000000"
                value={data.code}
                onValueChange={(v) => setData('code', v.replace(/\D/g, '').slice(0, 6))}
                aria-invalid={error ? true : undefined}
                className={cn(
                  authFieldClass,
                  'h-12 text-center font-mono text-xl tracking-[0.4em] tabular-nums'
                )}
              />
              <p className="text-sm text-muted-foreground">
                Two-factor isn’t on until this code is accepted.
              </p>
            </Field.Root>
            <button
              type="submit"
              disabled={processing || data.code.length < 6 || !data.currentPassword}
              className={authSubmitClass}
            >
              {processing ? (
                <>
                  <Loader2
                    size={18}
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />
                  Verifying…
                </>
              ) : (
                'Verify and turn on'
              )}
            </button>
          </form>
        </li>
      </ol>

      <p className="mt-6 text-center text-sm">
        <Link href="/account-settings" className={authLinkClass}>
          Cancel
        </Link>
      </p>
    </Frame>
  )
}

function BackupCodes({ backupCodes = [], regenerated }: Props) {
  const [saved, setSaved] = useState(false)
  const all = backupCodes.join('\n')

  // The codes are shown once and cannot be retrieved again.
  useEffect(() => {
    if (saved) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [saved])

  function download() {
    const blob = new Blob([`IAM Digital Covet backup codes\nEach code works once.\n\n${all}\n`], {
      type: 'text/plain',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'iam-digital-covet-backup-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Frame
      title={regenerated ? 'New backup codes' : 'Two-factor is on'}
      description="Use a backup code to sign in if you lose access to your authenticator app."
    >
      <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-accent/50 bg-accent/10 px-3 py-2.5 text-sm">
        <TriangleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
        <p>
          <span className="font-semibold">Save these now.</span> We can’t show them again. Each code
          works once.
          {regenerated && ' Your old codes no longer work.'}
        </p>
      </div>

      <section
        aria-label="Backup codes"
        className="rounded-lg border border-border bg-background p-4"
      >
        <ul className="grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-base tracking-wider tabular-nums">
          {backupCodes.map((c) => (
            <li key={c} className="select-all">
              {c}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <CopyButton text={all} label="Copy codes" />
          <button type="button" onClick={download} className={secondaryBtn}>
            <Download size={16} aria-hidden="true" />
            Download
          </button>
        </div>
      </section>

      <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm">
        <CheckBox checked={saved} onCheckedChange={setSaved} className="mt-0.5" />
        <span>I’ve saved these backup codes somewhere safe.</span>
      </label>

      {saved ? (
        <Link href="/account-settings" className={cn(authSubmitClass, 'mt-5')}>
          Continue
        </Link>
      ) : (
        <button
          type="button"
          disabled
          className="mt-5 flex h-11 w-full cursor-not-allowed items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground opacity-60"
        >
          Continue
        </button>
      )}
    </Frame>
  )
}

function AlreadyEnabled({ email }: Props) {
  return (
    <Frame
      title="Two-factor is already on"
      description={`Your sign-in for ${email} requires a second step.`}
    >
      <div className="flex items-start gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
        <ShieldCheck size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-success" />
        <p>
          To get new backup codes, use Two-factor in your account settings. New codes replace the
          old ones.
        </p>
      </div>
      <Link href="/account-settings" className={cn(authSubmitClass, 'mt-5')}>
        Go to account settings
      </Link>
    </Frame>
  )
}

export default function Setup2FA(props: Props) {
  return (
    <>
      <Head title="Set up two-factor" />
      {props.confirmed && props.backupCodes ? (
        <BackupCodes {...props} />
      ) : props.alreadyEnabled ? (
        <AlreadyEnabled {...props} />
      ) : (
        <Enroll {...props} />
      )}
    </>
  )
}
