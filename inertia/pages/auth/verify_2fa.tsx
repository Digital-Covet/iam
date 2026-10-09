import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Field } from '@base-ui/react/field'
import { Input } from '@base-ui/react/input'
import { Head, Link, useForm, usePage } from '@inertiajs/react'
import { Loader2 } from 'lucide-react'
import { AuthShell } from '~/components/auth/auth-shell'
import {
  AuthAlert,
  authFieldClass,
  authLinkClass,
  authSubmitClass,
} from '~/components/auth/auth-ui'
import { cn } from '~/lib/utils'

type Props = {
  attemptsRemaining?: number
  lockedUntil?: string | null
  backupCodesRemaining?: number
}

export default function Verify2FA({ attemptsRemaining, lockedUntil }: Props) {
  const { flash } = usePage()
  const [useBackup, setUseBackup] = useState(false)
  const { data, setData, post, processing, errors, transform } = useForm({
    code: '',
    backupCode: '',
  })
  const inputRef = useRef<HTMLInputElement>(null)

  // Send only the active field; the server picks the backup-code path
  // whenever `backupCode` is non-empty.
  transform((values) =>
    useBackup
      ? { code: '', backupCode: values.backupCode.trim() }
      : { code: values.code.replace(/\D/g, ''), backupCode: '' }
  )

  const error = flash?.error ?? errors.code ?? errors.backupCode
  const value = useBackup ? data.backupCode : data.code
  const ready = useBackup ? value.trim().length >= 4 : value.replace(/\D/g, '').length === 6

  // A miss clears only the code; the mode stays so the user can retry.
  useEffect(() => {
    if (error) {
      setData({ code: '', backupCode: '' })
      inputRef.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash, errors])

  function switchMode() {
    setUseBackup((v) => !v)
    setData({ code: '', backupCode: '' })
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (processing || !ready) return
    post('/verify-2fa')
  }

  return (
    <>
      <Head title="Two-factor verification" />
      <AuthShell
        eyebrow="Two-factor"
        title={useBackup ? 'Use a backup code' : 'Two-factor verification'}
        description={
          useBackup
            ? 'Enter one of the backup codes you saved. Each code works once.'
            : 'Enter the 6-digit code from your authenticator app.'
        }
      >
        <div role="alert" aria-live="assertive">
          {error && (
            <AuthAlert className="mb-5">
              <p>{error}</p>
            </AuthAlert>
          )}
        </div>

        <form onSubmit={submit} noValidate className="space-y-5">
          <Field.Root className="space-y-1.5">
            <Field.Label className="text-sm font-medium">
              {useBackup ? 'Backup code' : 'Authentication code'}
            </Field.Label>
            {useBackup ? (
              <Input
                key="backup"
                ref={inputRef}
                id="backupCode"
                name="backupCode"
                type="text"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                required
                autoFocus
                maxLength={32}
                value={data.backupCode}
                onValueChange={(v) => setData('backupCode', v)}
                aria-invalid={error ? true : undefined}
                className={cn(authFieldClass, 'h-12 text-center font-mono text-xl tracking-wider')}
              />
            ) : (
              <Input
                key="totp"
                ref={inputRef}
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                autoFocus
                placeholder="000000"
                value={data.code}
                onValueChange={(v) => setData('code', v.replace(/\D/g, '').slice(0, 6))}
                // Paste-friendly: strips spaces/dashes ("123 456") and caps at 6 digits.
                aria-invalid={error ? true : undefined}
                className={cn(
                  authFieldClass,
                  'h-12 text-center font-mono text-xl tracking-[0.5em] tabular-nums'
                )}
              />
            )}
            {typeof attemptsRemaining === 'number' && attemptsRemaining < 5 && (
              <p className="text-sm text-muted-foreground">
                {attemptsRemaining} {attemptsRemaining === 1 ? 'attempt' : 'attempts'} remaining.
              </p>
            )}
            {lockedUntil && (
              <p className="text-sm font-medium text-error">
                Locked until {new Date(lockedUntil).toUTCString()}. Try again afterwards.
              </p>
            )}
          </Field.Root>

          <button type="submit" disabled={processing || !ready} className={authSubmitClass}>
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
              'Verify'
            )}
          </button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-2 text-sm">
          <button type="button" onClick={switchMode} className={authLinkClass}>
            {useBackup ? 'Use your authenticator app instead' : 'Use a backup code'}
          </button>
          <Link href="/login" className="text-muted-foreground underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    </>
  )
}
