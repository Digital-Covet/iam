import { cn } from '~/lib/utils'

/**
 * "DC" monogram formed from two opposing doorway brackets. Static, decorative:
 * the product name always sits beside it.
 */
export function IdentitySeal({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={cn('shrink-0 text-primary', className)}
    >
      {/* D: left doorway */}
      <path d="M3 4h5.5a6 6 0 0 1 0 16H3V4Z" />
      {/* C: opposing bracket */}
      <path d="M21 8.5h-3.5a3.5 3.5 0 0 0 0 7H21" />
    </svg>
  )
}
