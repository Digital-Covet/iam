import type { ReactNode } from 'react'

type Props = {
  title: string
  description?: string
  /** Right-aligned page actions, e.g. "Invite user". */
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: Props) {
  return (
    <div className="ledger-rule mb-6 flex flex-wrap items-start justify-between gap-4 pb-5">
      <div className="min-w-0">
        <h1
          tabIndex={-1}
          className="font-display text-[2.125rem] leading-tight font-medium tracking-[-0.02em] outline-none"
        >
          {title}
        </h1>
        {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
