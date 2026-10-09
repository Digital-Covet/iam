import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { SidebarContent } from '~/components/sidebar'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isMac: boolean
  onOpenCommand: () => void
}

/** Navigation drawer for <768px. Loaded on first open. */
export function MobileDrawer({ open, onOpenChange, isMac, onOpenCommand }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-140 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none md:hidden" />
        <Dialog.Popup
          aria-label="Navigation"
          className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-sidebar shadow-float transition-transform duration-180 data-ending-style:-translate-x-full data-starting-style:-translate-x-full motion-reduce:transition-none md:hidden"
        >
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>
          <Dialog.Close
            aria-label="Close navigation"
            className="absolute top-3 right-3 grid size-10 place-items-center rounded-md hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X size={18} aria-hidden="true" />
          </Dialog.Close>
          <SidebarContent
            rail={false}
            isMac={isMac}
            onOpenCommand={() => {
              onOpenChange(false)
              onOpenCommand()
            }}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
