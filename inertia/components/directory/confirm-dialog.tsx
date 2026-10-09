import type { ReactNode } from 'react'
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { btnDanger, btnPrimary, btnSecondary, dialogBackdrop } from './shared'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  /** Use the error-toned button for consequential, hard-to-reverse actions. */
  destructive?: boolean
  onConfirm: () => void
  children?: ReactNode
}

/**
 * Escape and "Cancel" close without committing; only the confirm button acts.
 * Focus returns to whatever opened it.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
  children,
}: Props) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className={dialogBackdrop} />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-60 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface-raised p-6 shadow-float transition-[opacity,translate] duration-180 data-ending-style:opacity-0 data-starting-style:-translate-y-[calc(50%+8px)] data-starting-style:opacity-0 motion-reduce:transition-none">
          <AlertDialog.Title className="ledger-rule pb-3 text-xl leading-tight font-semibold">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-3 text-sm text-muted-foreground">
            {description}
          </AlertDialog.Description>
          {children && <div className="mt-4">{children}</div>}
          <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <AlertDialog.Close className={btnSecondary}>Cancel</AlertDialog.Close>
            <button
              type="button"
              className={destructive ? btnDanger : btnPrimary}
              onClick={() => {
                onConfirm()
                onOpenChange(false)
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
