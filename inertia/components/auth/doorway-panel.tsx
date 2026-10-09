import { AppWindow, ScrollText, ShieldCheck } from 'lucide-react'
import { IdentitySeal } from '~/components/identity-seal'

const D_PATH = 'M3 4h5.5a6 6 0 0 1 0 16H3V4Z'
const C_PATH = 'M21 8.5h-3.5a3.5 3.5 0 0 0 0 7H21'

/**
 * Decorative doorway: the seal's two brackets at poster size. Strokes draw in
 * via `.auth-doorway` (see app.css). Delete this file's usage to remove it.
 */
function Doorway({ className, offset = false }: { className?: string; offset?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="0.12"
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={`${offset ? '' : 'auth-doorway '}pointer-events-none ${className ?? ''}`}
    >
      <path d={D_PATH} pathLength={1} stroke="currentColor" />
      <path d={C_PATH} pathLength={1} stroke="currentColor" />
    </svg>
  )
}

/** Left half of the desktop auth layout. Purely decorative apart from the product name. */
const POINTS = [
  { icon: AppWindow, text: 'Single sign-on across Digital Covet apps' },
  { icon: ShieldCheck, text: 'Two-factor protection for every account' },
  { icon: ScrollText, text: 'Every access decision recorded in the audit log' },
]

export function DoorwayPanel() {
  return (
    <aside className="auth-panel-grid auth-panel-glow relative hidden overflow-hidden bg-panel text-panel-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div className="relative z-10 flex items-center gap-3">
        <IdentitySeal size={32} className="text-panel-accent" />
        <span className="text-sm font-semibold">IAM Digital Covet</span>
      </div>

      <div className="relative z-10 max-w-md">
        <p className="text-3xl leading-tight font-semibold tracking-tight text-balance">
          One identity for everything at Digital Covet.
        </p>
        <ul className="mt-8 space-y-3.5 text-sm text-panel-muted">
          {POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-panel-line/50 bg-white/5 text-panel-accent">
                <Icon size={16} aria-hidden="true" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative z-10 font-code text-xs tracking-wide text-panel-muted uppercase">
        Identity &amp; access
      </p>

      <Doorway
        offset
        className="absolute -bottom-24 -left-20 size-[420px] translate-x-6 -translate-y-4 text-panel-accent opacity-30"
      />
      <Doorway className="absolute -bottom-24 -left-20 size-[420px] text-panel-line" />
    </aside>
  )
}
