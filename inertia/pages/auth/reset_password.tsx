import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Field } from '@base-ui/react/field'
import { Input } from '@base-ui/react/input'
import { Head, Link, useForm, usePage } from '@inertiajs/react'
import { Check, Circle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { AuthShell } from '~/components/auth/auth-shell'
import {
  AuthAlert,
  authFieldClass,
  authLinkClass,
  authSubmitClass,
} from '~/components/auth/auth-ui'
import { cn } from '~/lib/utils'

type Policy = {
  minLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireNumber: boolean
  requireSpecial: boolean
}

type Props = { token: string; kind: 'reset' | 'invite' | string; policy: Policy }

function rulesFor(policy: Policy) {
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

function PasswordInput({
  id,
  label,
  value,
  onChange,
  show,
  onToggle,
  invalid,
  autoFocus,
  describedBy,
  inputRef,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggle: () => void
  invalid?: boolean
  autoFocus?: boolean
  describedBy?: string
  inputRef?: React.Ref<HTMLInputElement>
}) {
  return (
    <Field.Root className="space-y-1.5">
      <Field.Label className="text-sm font-medium">{label}</Field.Label>
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          name={id}
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          required
          autoFocus={autoFocus}
          value={value}
          onValueChange={onChange}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
          className={cn(authFieldClass, 'pr-12')}
        />
        <button
          type="button"
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={show}
          aria-controls={id}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onToggle}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-muted-foreground transition-colors duration-140 hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
        >
          {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    </Field.Root>
  )
}

export default function ResetPassword({ token, kind, policy }: Props) {
  const { flash } = usePage()
  const { data, setData, post, processing, errors } = useForm({
    password: '',
    passwordConfirmation: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const passwordRef = useRef<HTMLInputElement>(null)
  const isInvite = kind === 'invite'

  const rules = useMemo(() => rulesFor(policy), [policy])
  const results = rules.map((r) => ({ ...r, met: r.test(data.password) }))
  const metCount = results.filter((r) => r.met).length
  const allMet = metCount === results.length
  const mismatch =
    data.passwordConfirmation.length > 0 && data.password !== data.passwordConfirmation
  const canSubmit = allMet && data.password === data.passwordConfirmation && !processing

  const serverError = flash?.error ?? errors.password ?? errors.passwordConfirmation

  // A rejected submit (policy, reuse of a recent password) clears the fields
  // and returns focus to the new-password field.
  useEffect(() => {
    if (serverError) {
      setData({ password: '', passwordConfirmation: '' })
      passwordRef.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash, errors])

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    post(`/reset-password/${token}`)
  }

  return (
    <>
      <Head title="Set your password" />
      <AuthShell
        eyebrow="Set password"
        title="Set your password"
        description={
          isInvite
            ? 'You’ve been invited to Digital Covet. Choose a password to accept and activate your account.'
            : undefined
        }
      >
        <div role="alert" aria-live="assertive">
          {serverError && (
            <AuthAlert className="mb-5">
              <p>{serverError}</p>
            </AuthAlert>
          )}
        </div>

        <form onSubmit={submit} noValidate className="space-y-5">
          <PasswordInput
            id="password"
            label="New password"
            value={data.password}
            onChange={(v) => setData('password', v)}
            show={showPassword}
            onToggle={() => setShowPassword((s) => !s)}
            invalid={Boolean(errors.password)}
            autoFocus
            describedBy="password-rules"
            inputRef={passwordRef}
          />

          {/* Visible requirements with a plain strength meter: icon + word, never colour alone. */}
          <div id="password-rules" className="-mt-2 space-y-2.5">
            <div className="flex items-center gap-3">
              <div
                role="progressbar"
                aria-label="Requirements met"
                aria-valuemin={0}
                aria-valuemax={results.length}
                aria-valuenow={metCount}
                className="flex h-1.5 flex-1 gap-1"
              >
                {results.map((_, i) => (
                  <span
                    key={i}
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

          <div className="space-y-1.5">
            <PasswordInput
              id="passwordConfirmation"
              label="Confirm password"
              value={data.passwordConfirmation}
              onChange={(v) => setData('passwordConfirmation', v)}
              show={showConfirm}
              onToggle={() => setShowConfirm((s) => !s)}
              invalid={mismatch || Boolean(errors.passwordConfirmation)}
              describedBy={mismatch ? 'confirm-error' : undefined}
            />
            {mismatch && (
              <p id="confirm-error" className="text-sm text-error">
                Passwords don’t match.
              </p>
            )}
          </div>

          <button type="submit" disabled={!canSubmit} className={authSubmitClass}>
            {processing ? (
              <>
                <Loader2
                  size={18}
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
                Saving…
              </>
            ) : isInvite ? (
              'Set password and continue'
            ) : (
              'Set new password'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm">
          <Link href="/login" className={authLinkClass}>
            Back to sign in
          </Link>
        </p>
      </AuthShell>
    </>
  )
}
