import { memo } from 'react'
import { Tooltip } from '@base-ui/react/tooltip'
import { Command, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { IdentitySeal } from '~/components/identity-seal'
import { focusRing, hoverBg, RailTooltip, SidebarLink } from '~/components/sidebar-link'
import { UserMenu } from '~/components/user-menu'
import { usePermissions } from '~/hooks/use-permissions'
import { navGroups } from '~/lib/navigation'
import { preloadCommandPalette } from '~/lib/lazy'
import { cn } from '~/lib/utils'

type Props = {
  /** Icon-only rail. Never true in the mobile drawer. */
  rail: boolean
  isMac: boolean
  onToggleRail?: () => void
  onOpenCommand: () => void
  onNavigate?: () => void
}

function SidebarContentBase({ rail, isMac, onToggleRail, onOpenCommand, onNavigate }: Props) {
  const { satisfies } = usePermissions()

  const groups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => satisfies(i.requires)) }))
    .filter((g) => g.items.length > 0)

  return (
    <Tooltip.Provider delay={200}>
      <div
        className={cn(
          'flex h-16 shrink-0 items-center gap-3 border-b border-border',
          rail ? 'justify-center' : 'px-4'
        )}
      >
        <span className="stamp grid size-8 shrink-0 place-items-center rounded-lg">
          <IdentitySeal size={20} />
        </span>
        {!rail && (
          <span className="min-w-0">
            <span className="block text-sm leading-tight font-semibold">IAM Digital Covet</span>
            <span
              aria-hidden="true"
              className="block font-mono text-[0.6875rem] leading-tight text-muted-foreground"
            >
              Access console
            </span>
          </span>
        )}
        {!rail && onToggleRail && (
          <button
            type="button"
            aria-label="Collapse sidebar"
            onClick={onToggleRail}
            className={cn('ml-auto grid size-10 place-items-center rounded-md', hoverBg, focusRing)}
          >
            <PanelLeftClose size={18} aria-hidden="true" />
          </button>
        )}
      </div>
      {rail && onToggleRail && (
        <RailTooltip label="Expand sidebar" enabled>
          <button
            type="button"
            aria-label="Expand sidebar"
            onClick={onToggleRail}
            className={cn(
              'mx-auto mt-3 grid size-10 place-items-center rounded-md',
              hoverBg,
              focusRing
            )}
          >
            <PanelLeftOpen size={18} aria-hidden="true" />
          </button>
        </RailTooltip>
      )}

      <RailTooltip label="Jump to…" enabled={rail}>
        <button
          type="button"
          aria-label={rail ? 'Jump to…' : undefined}
          onClick={onOpenCommand}
          // Warm the palette chunk before the click lands.
          onPointerEnter={preloadCommandPalette}
          onFocus={preloadCommandPalette}
          className={cn(
            'm-3 flex h-10 items-center gap-2 rounded-md border border-border-strong bg-surface/60 px-3 text-sm text-muted-foreground transition-colors duration-140 hover:text-foreground motion-reduce:transition-none',
            hoverBg,
            focusRing,
            rail && 'justify-center px-0'
          )}
        >
          <Command size={18} aria-hidden="true" />
          {!rail && (
            <>
              <span>Jump to…</span>
              <kbd className="ml-auto font-mono text-xs">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
            </>
          )}
        </button>
      </RailTooltip>

      <nav aria-label="Primary navigation" className="min-h-0 flex-1 overflow-y-auto px-2">
        {groups.map((group) => (
          <section key={group.label} aria-label={group.label} className="mb-6">
            {!rail && (
              <h2 className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-muted-foreground">
                {group.label}
                <span aria-hidden="true" className="h-px flex-1 bg-border-strong/40" />
              </h2>
            )}
            {rail && <div aria-hidden="true" className="mx-3 mb-2 h-px bg-border-strong/40" />}
            {group.items.map((item) => (
              <SidebarLink key={item.href} {...item} rail={rail} onNavigate={onNavigate} />
            ))}
          </section>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border p-2">
        <UserMenu rail={rail} />
      </div>
    </Tooltip.Provider>
  )
}

export const SidebarContent = memo(SidebarContentBase)
