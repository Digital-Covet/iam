import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { cn } from '~/lib/utils'
import { dialogBackdrop, focusRing } from '~/components/directory/shared'

const popupCenter =
  'fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface-raised p-6 shadow-float transition-[opacity,translate] duration-180 data-ending-style:opacity-0 data-starting-style:-translate-y-[calc(50%+8px)] data-starting-style:opacity-0 motion-reduce:transition-none'

export function DialogHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="ledger-rule -mx-1 flex items-start justify-between gap-3 px-1 pb-4">
      <div>
        <Dialog.Title className="text-xl leading-tight font-semibold">{title}</Dialog.Title>
        {description && (
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            {description}
          </Dialog.Description>
        )}
      </div>
      <Dialog.Close
        aria-label="Close"
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-md hover:bg-hover',
          focusRing
        )}
      >
        <X size={18} aria-hidden="true" />
      </Dialog.Close>
    </div>
  )
}

export { Dialog, dialogBackdrop, popupCenter }
