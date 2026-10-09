import { Tooltip } from '@base-ui/react/tooltip'

/** Small label tooltip for icon-only buttons. Renders nothing extra when `label` is undefined. */
export function InfoTooltip({
  label,
  children,
  side = 'top',
}: {
  label?: string
  children: React.ReactElement
  side?: 'top' | 'right' | 'bottom' | 'left'
}) {
  if (!label) return children
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner side={side} sideOffset={8} className="z-[80]">
          <Tooltip.Popup className="rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-xs shadow-float">
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

export { Tooltip }
