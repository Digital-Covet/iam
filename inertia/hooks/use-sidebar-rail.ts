import { useCallback, useEffect, useState } from 'react'

const RAIL_KEY = 'iam.sidebar.rail'

/** Collapsed-rail preference; a per-viewer convenience, so storage failures are ignored. */
export function useSidebarRail() {
  const [rail, setRail] = useState(false)

  useEffect(() => {
    try {
      setRail(localStorage.getItem(RAIL_KEY) === '1')
    } catch {
      // Storage unavailable: keep the default.
    }
  }, [])

  const toggleRail = useCallback(() => {
    setRail((prev) => {
      const next = !prev
      try {
        localStorage.setItem(RAIL_KEY, next ? '1' : '0')
      } catch {
        // Ignore.
      }
      return next
    })
  }, [])

  return { rail, toggleRail }
}
