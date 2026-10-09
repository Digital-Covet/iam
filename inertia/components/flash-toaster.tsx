import { Suspense, useState } from 'react'
import { usePage } from '@inertiajs/react'
import { LazyToastRegion } from '~/lib/lazy'

/**
 * Tiny gate: the toast library is only downloaded once the server sends a
 * flash message, and stays mounted afterwards.
 */
export function FlashToaster() {
  const { flash } = usePage()
  const [needed, setNeeded] = useState(false)

  if (!needed && (flash?.success || flash?.error)) setNeeded(true)
  if (!needed) return null

  return (
    <Suspense fallback={null}>
      <LazyToastRegion success={flash?.success} error={flash?.error} />
    </Suspense>
  )
}
