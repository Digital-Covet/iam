import { useEffect, useRef, type ReactNode } from 'react'
import { Head } from '@inertiajs/react'
import type { LucideIcon } from 'lucide-react'
import { IdentitySeal } from '~/components/identity-seal'

export const statusPrimaryButton =
  'flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-140 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none'

export const statusSecondaryButton =
  'flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-sm font-semibold text-foreground transition-colors duration-140 hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none'

export function StatusFrame({ title, children }: { title: string; children: ReactNode }) {
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

export function StatusCard({
  icon: Icon,
  heading,
  children,
}: {
  icon: LucideIcon
  heading: string
  children: ReactNode
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
