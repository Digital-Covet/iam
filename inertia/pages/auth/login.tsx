import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Field } from '@base-ui/react/field'
import { Input } from '@base-ui/react/input'
import { Head, Link, useForm, usePage } from '@inertiajs/react'
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'
import { AuthShell } from '~/components/auth/auth-shell'
import {
  AuthAlert,
  authFieldClass,
  authIconClass,
  authLinkClass,
  authSubmitClass,
} from '~/components/auth/auth-ui'
import { cn } from '~/lib/utils'

export default function Login() {
  const { flash } = usePage()
  const { data, setData, post, processing, errors, transform } = useForm({
    email: '',
    password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  transform((values) => ({ ...values, email: values.email.trim() }))

  // Server-side failures are generic (no account enumeration). The alert
  // carries the message; the rejected password is cleared and focus returns
  // to the first field. Keyed on `flash` so a repeated identical error re-fires.
  const serverError = flash?.error ?? errors.email ?? errors.password
  useEffect(() => {
    if (serverError) {
      setData('password', '')
      emailRef.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash, errors])

  function submit(e: FormEvent) {
    e.preventDefault()
    if (processing) return
    post('/login')
  }

  return (
    <>
      <Head title="Sign in" />
      <AuthShell
        eyebrow="Sign in"
        title="Welcome back"
        description="Sign in with your Digital Covet email."
      >
        <div role="alert" aria-live="assertive">
          {serverError && (
            <AuthAlert className="mb-5">
              <p>
                <span className="font-semibold">Sign-in failed. </span>
                {serverError}
              </p>
            </AuthAlert>
          )}
        </div>

        {/* e.g. "Your password is set. Sign in to continue." after a reset. */}
        <div role="status">
          {flash?.success && !serverError && (
            <AuthAlert tone="success" className="mb-5">
              <p>{flash.success}</p>
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
                ref={emailRef}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                autoFocus
                placeholder="name@digitalcovet.com"
                value={data.email}
                onValueChange={(v) => setData('email', v)}
                aria-invalid={serverError ? true : undefined}
                className={cn(authFieldClass, 'pl-11')}
              />
            </div>
          </Field.Root>

          <Field.Root className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Field.Label className="text-sm font-medium">Password</Field.Label>
              <Link href="/forgot-password" className={cn(authLinkClass, 'text-sm')}>
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <span className={authIconClass}>
                <Lock size={18} aria-hidden="true" />
              </span>
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={data.password}
                onValueChange={(v) => setData('password', v)}
                aria-invalid={serverError ? true : undefined}
                className={cn(authFieldClass, 'pr-12 pl-11')}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                aria-controls="password"
                // Keep focus in the field so toggling does not steal it.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-muted-foreground transition-colors duration-140 hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
              >
                {showPassword ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>
          </Field.Root>

          <button
            type="submit"
            disabled={processing}
            aria-disabled={processing}
            className={authSubmitClass}
          >
            {processing ? (
              <>
                <Loader2
                  size={18}
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <ArrowRight size={18} aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New to Digital Covet?{' '}
          <Link href="/signup" className={authLinkClass}>
            Create an account
          </Link>
        </p>
      </AuthShell>
    </>
  )
}
