import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '~/lib/utils'

/** Text input look shared by every auth page. Add `pr-12` for fields with a trailing toggle. */
export const authFieldClass =
  'auth-field h-11 w-full rounded-lg border border-border-strong bg-surface px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-error'

/** Wrapper for a leading icon inside a `relative` field container. Pair with `pl-11` on the input. */
export const authIconClass =
  'pointer-events-none absolute inset-y-0 left-0 grid w-11 place-items-center text-muted-foreground'

export const authLinkClass =
  'rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export const authSubmitClass =
  'flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-linear-to-b from-primary to-primary/85 text-sm font-semibold text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_6px_16px_-6px_color-mix(in_oklab,var(--primary)_70%,transparent)] transition-colors duration-140 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-safe:active:translate-y-px'

/** Inline message box. Wrap in the page's existing role="alert" / role="status" region. */
export function AuthAlert({
  tone = 'error',
  className,
  children,
}: {
  tone?: 'error' | 'success'
  className?: string
  children: React.ReactNode
}) {
  const Icon = tone === 'error' ? AlertCircle : CheckCircle2
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm',
        tone === 'error'
          ? 'border-error/40 bg-error/10 text-error'
          : 'border-success/40 bg-success/10 text-success',
        className
      )}
    >
      <Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  )
}
