import { Link, usePage } from '@inertiajs/react'
import { Tooltip } from '@base-ui/react/tooltip'
import type { LucideIcon } from 'lucide-react'
import { isActivePath } from '~/lib/navigation'
import { cn } from '~/lib/utils'

export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
export const hoverBg = 'hover:bg-hover'

/** Tooltip only wraps the control when the sidebar is an icon rail. */
export function RailTooltip({
  label,
  enabled,
  children,
}: {
  label: string
  enabled: boolean
  children: React.ReactElement
}) {
  if (!enabled) return children
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner side="right" sideOffset={10} className="z-50">
          <Tooltip.Popup className="rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-xs shadow-float">
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

type Props = {
  href: string
  label: string
  icon: LucideIcon
  rail: boolean
  onNavigate?: () => void
}

export function SidebarLink({ href, label, icon: Icon, rail, onNavigate }: Props) {
  const { url } = usePage()
  const active = isActivePath(url, href)

  return (
    <RailTooltip label={label} enabled={rail}>
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        aria-label={rail ? label : undefined}
        onClick={onNavigate}
        className={cn(
          'group relative mb-1 flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-140 motion-reduce:transition-none',
          focusRing,
          rail && 'justify-center px-0',
          active
            ? 'border border-border bg-surface font-semibold text-primary shadow-tab before:absolute before:top-2 before:bottom-2 before:left-0 before:w-[3px] before:rounded-full before:bg-primary'
            : cn('text-foreground', hoverBg)
        )}
      >
        <Icon
          size={18}
          aria-hidden="true"
          className={cn(
            !active && 'text-muted-foreground transition-colors group-hover:text-foreground'
          )}
        />
        {!rail && <span>{label}</span>}
      </Link>
    </RailTooltip>
  )
}
