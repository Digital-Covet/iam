import { Switch } from '@base-ui/react/switch'
import { cn } from '~/lib/utils'
import { focusRing } from '~/components/directory/shared'

type Props = {
  checked: boolean
  onCheckedChange: (next: boolean) => void
  disabled?: boolean
  label: string
  describedBy?: string
  labelledBy?: string
}

/** Shared on/off switch. Single source of truth for track/thumb geometry. */
export function ToggleSwitch({
  checked,
  onCheckedChange,
  disabled,
  label,
  describedBy,
  labelledBy,
}: Props) {
  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-border-strong bg-background transition-colors duration-140 data-checked:border-primary data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-60 motion-reduce:transition-none',
        focusRing
      )}
    >
      <Switch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-muted-foreground transition-transform duration-140 data-checked:translate-x-5 data-checked:bg-primary-foreground motion-reduce:transition-none" />
    </Switch.Root>
  )
}

export { Switch }
