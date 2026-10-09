import { useEffect } from 'react'
import { Toast } from '@base-ui/react/toast'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import { cn } from '~/lib/utils'

type Props = { success?: string; error?: string }

/**
 * The Base UI toast lives in its own chunk. The viewport is a landmark with a
 * polite live region (assertive for errors), so saved and error feedback is
 * announced without stealing focus.
 */
export function ToastRegion({ success, error }: Props) {
  return (
    <Toast.Provider limit={3}>
      <FlashEmitter success={success} error={error} />
      <Toast.Portal>
        <Toast.Viewport className="fixed right-4 bottom-4 z-100 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 outline-none">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  )
}

function FlashEmitter({ success, error }: Props) {
  const toastManager = Toast.useToastManager()

  useEffect(() => {
    if (success) toastManager.add({ type: 'success', title: success })
    if (error) toastManager.add({ type: 'error', title: error, priority: 'high' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- manager identity is stable enough; only new flash text should emit
  }, [success, error])

  return null
}

function ToastList() {
  const { toasts } = Toast.useToastManager()

  return toasts.map((toast) => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      className={cn(
        'flex items-start gap-3 rounded-xl border border-border bg-surface p-3 pr-2 text-sm shadow-float',
        'transition-[opacity,transform] duration-200 motion-reduce:transition-none',
        'data-starting-style:translate-y-2 data-starting-style:opacity-0',
        'data-ending-style:translate-x-4 data-ending-style:opacity-0',
        'data-limited:hidden'
      )}
    >
      <Toast.Content className="flex min-w-0 flex-1 items-start gap-2.5">
        {toast.type === 'error' ? (
          <AlertCircle size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-error" />
        ) : (
          <CheckCircle2 size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
        )}
        <Toast.Title className="min-w-0 text-sm font-medium wrap-break-word" />
      </Toast.Content>
      <Toast.Close
        aria-label="Dismiss notification"
        className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <X size={16} aria-hidden="true" />
      </Toast.Close>
    </Toast.Root>
  ))
}
