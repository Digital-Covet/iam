import { IdentitySeal } from '~/components/identity-seal'
import { cn } from '~/lib/utils'
import { DoorwayPanel } from '~/components/auth/doorway-panel'

type Props = {
  title: React.ReactNode
  /** Small mono label above the title, e.g. "Sign in". */
  eyebrow?: string
  description?: React.ReactNode
  /** Rendered between the brand row and the title (e.g. a success mark). */
  mark?: React.ReactNode
  width?: 'md' | 'lg'
  children: React.ReactNode
}

/**
 * Shared layout for all auth pages: doorway panel beside the form on desktop,
 * slim brand band above the form below `lg`.
 */
export function AuthShell({ title, eyebrow, description, mark, width = 'md', children }: Props) {
  return (
    <div className="min-h-dvh bg-background text-foreground lg:grid lg:grid-cols-[5fr_6fr]">
      <a
        href="#auth-main"
        className="sr-only z-60 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to form
      </a>

      <DoorwayPanel />

      <div className="auth-stage lg:flex lg:items-center lg:justify-center">
        <div
          aria-hidden="true"
          className="auth-panel-grid flex items-center gap-3 bg-panel px-4 py-3 text-panel-foreground lg:hidden"
        >
          <IdentitySeal size={24} className="text-panel-accent" />
          <span className="text-sm font-semibold">IAM Digital Covet</span>
        </div>

        <div className="grid place-items-center px-4 py-10 sm:px-8 lg:w-full lg:py-12">
          <main
            id="auth-main"
            className={cn(
              'auth-rise w-full sm:rounded-xl sm:border sm:border-border sm:bg-surface sm:p-8 sm:shadow-form lg:rounded-2xl lg:border lg:border-border lg:bg-surface lg:p-10 lg:shadow-form',
              width === 'lg' ? 'max-w-120' : 'max-w-105'
            )}
          >
            <header className="mb-7">
              <p className="sr-only">IAM Digital Covet</p>
              {mark}
              {eyebrow && (
                <p className="mb-3 flex items-center gap-2 font-code text-xs font-medium tracking-widest text-primary uppercase">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
                  {eyebrow}
                </p>
              )}
              <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance">
                {title}
              </h1>
              {description && (
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">
                  {description}
                </p>
              )}
            </header>
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
