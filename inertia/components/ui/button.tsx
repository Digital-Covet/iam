import type { ButtonHTMLAttributes } from 'react'
import { cn } from '~/lib/utils'
import { focusRing } from '~/components/directory/shared'

const btnBase = cn(
  'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors duration-140 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none',
  focusRing
)

export const buttonVariants = {
  primary: cn(
    btnBase,
    'bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.18)] hover:bg-primary/90 disabled:hover:bg-primary motion-safe:active:translate-y-px'
  ),
  secondary: cn(btnBase, 'border border-border-strong bg-surface text-foreground hover:bg-hover'),
  danger: cn(
    btnBase,
    'bg-error text-primary-foreground hover:bg-error/90 disabled:hover:bg-error motion-safe:active:translate-y-px'
  ),
  ghost: cn(
    'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors duration-140 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none',
    'text-foreground hover:bg-hover',
    focusRing
  ),
}

type Variant = keyof typeof buttonVariants

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
}

/** Shared Base UI-era button. Visual only — behaviour stays native. */
export function Button({ variant = 'primary', className, type = 'button', ...rest }: Props) {
  return <button type={type} className={cn(buttonVariants[variant], className)} {...rest} />
}
