import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type Props = {
  icon: LucideIcon
  title: string
  description: string
  /** Optional single next action (a Button). */
  children?: ReactNode
}

/** Empty / no-results state: icon in a bordered square, one sentence, one action. */
export function EmptyState({ icon: Icon, title, description, children }: Props) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span
        aria-hidden="true"
        className="grid size-12 place-items-center rounded-lg border border-border-strong bg-background text-muted-foreground"
      >
        <Icon size={22} />
      </span>
      <p className="mt-4 font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {children && <div className="mt-4 flex justify-center">{children}</div>}
    </div>
  )
}
