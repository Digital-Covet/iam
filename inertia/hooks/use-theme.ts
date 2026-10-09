import { useCallback, useEffect, useState } from 'react'
import { usePage } from '@inertiajs/react'

export type Theme = 'light' | 'dark'

/**
 * Theme is stored in the `app_theme` cookie, which the server reads (see
 * InertiaMiddleware) and the inline script in inertia_layout.edge applies
 * before first paint.
 */
export function useTheme() {
  const { preferences } = usePage().props
  const [theme, setThemeState] = useState<Theme>(preferences?.theme ?? 'light')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    document.cookie = `app_theme=${next}; path=/; max-age=31536000; samesite=lax`
    setThemeState(next)
  }, [])

  const toggleTheme = useCallback(
    () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    [theme, setTheme]
  )

  return { theme, setTheme, toggleTheme }
}
