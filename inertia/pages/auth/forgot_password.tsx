import { useState, type FormEvent } from 'react'
import { Field } from '@base-ui/react/field'
import { Input } from '@base-ui/react/input'
import { Head, Link, useForm, usePage } from '@inertiajs/react'
import { ArrowLeft, Loader2, Mail } from 'lucide-react'
import { AuthShell } from '~/components/auth/auth-shell'
import {
  AuthAlert,
  authFieldClass,
  authIconClass,
  authLinkClass,
  authSubmitClass,
} from '~/components/auth/auth-ui'
import { cn } from '~/lib/utils'

/** Small outlined mail-with-check mark for the success state (decoration map: forgot password). */
function MailCheck({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="56"
      height="56"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="6" y="10" width="36" height="26" rx="4" />
      <path d="m8 14 16 12 16-12" />
      <circle cx="37" cy="36" r="8" className="fill-surface" />
      <path d="m33.5 36 2.5 2.5 4.5-5" />
    </svg>
  )
}

export default function ForgotPassword() {
  const { flash } = usePage()
  const { data, setData, post, processing, errors, transform } = useForm({ email: '' })
  // The address as submitted, kept visible in the confirmation (never looked up client-side).
  const [sentTo, setSentTo] = useState<string | null>(null)

  transform((values) => ({ ...values, email: values.email.trim() }))

  const sent = Boolean(flash?.success) && sentTo !== null
  const error = errors.email ?? flash?.error

  function submit(e: FormEvent) {
    e.preventDefault()
    if (processing) return
    const address = data.email.trim()
    post('/forgot-password', {
      preserveScroll: true,
      onSuccess: () => setSentTo(address),
    })
  }

  return (
    <>
      <Head title="Reset password" />
      <AuthShell
        eyebrow="Account recovery"
        title={sent ? 'Check your email' : 'Reset your password'}
        description={
          sent
            ? 'If that email address is registered, we’ll send instructions.'
            : 'Enter your email and we’ll send you a link to set a new password.'
        }
        mark={sent ? <MailCheck className="mb-4 text-secondary" /> : null}
      >
        {sent ? (
          <div className="space-y-5">
            <p role="status" className="text-sm">
              Request sent for <span className="font-medium break-all">{sentTo}</span>. The link
              expires, so use it soon. Nothing arrived? Check spam, or{' '}
              <button
                type="button"
                onClick={() => setSentTo(null)}
                className={cn(authLinkClass, 'inline')}
              >
                try again
              </button>
              .
            </p>
            <Link
              href="/login"
              className={cn(authLinkClass, 'inline-flex items-center gap-1.5 text-sm')}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <div role="alert" aria-live="assertive">
              {error && (
                <AuthAlert className="mb-5">
                  <p>{error}</p>
                </AuthAlert>
              )}
            </div>

            <form onSubmit={submit} noValidate className="space-y-5">
              <Field.Root className="space-y-1.5">
                <Field.Label className="text-sm font-medium">Email</Field.Label>
                <div className="relative">
                  <span className={authIconClass}>
                    <Mail size={18} aria-hidden="true" />
                  </span>
                  <Input
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    autoFocus
                    placeholder="name@digitalcovet.com"
                    value={data.email}
                    onValueChange={(v) => setData('email', v)}
                    aria-invalid={errors.email ? true : undefined}
                    className={cn(authFieldClass, 'pl-11')}
                  />
                </div>
              </Field.Root>

              <button type="submit" disabled={processing} className={authSubmitClass}>
                {processing ? (
                  <>
                    <Loader2
                      size={18}
                      aria-hidden="true"
                      className="animate-spin motion-reduce:animate-none"
                    />
                    Sending…
                  </>
                ) : (
                  'Send reset link'
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm">
              <Link href="/login" className={cn(authLinkClass, 'inline-flex items-center gap-1.5')}>
                <ArrowLeft size={16} aria-hidden="true" />
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </AuthShell>
    </>
  )
}
