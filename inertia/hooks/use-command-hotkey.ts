import { useEffect, useState } from 'react'

/** Binds Ctrl/⌘K client-side only (SSR-safe) and reports the platform for the hint label. */
export function useCommandHotkey(onToggle: () => void) {
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform))
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onToggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onToggle])

  return { isMac }
}
