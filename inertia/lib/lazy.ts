import { lazy } from 'react'

/**
 * Deferred shell chunks. Each is fetched on first use and cached by the
 * module system, so preloading on intent (hover/focus) is free to repeat.
 */
const loadCommandPalette = () => import('~/components/command-palette')
const loadMobileDrawer = () => import('~/components/mobile-drawer')
const loadToastRegion = () => import('~/components/toast-region')

export const preloadCommandPalette = () => void loadCommandPalette()
export const preloadMobileDrawer = () => void loadMobileDrawer()

export const LazyCommandPalette = lazy(() =>
  loadCommandPalette().then((m) => ({ default: m.CommandPalette }))
)
export const LazyMobileDrawer = lazy(() =>
  loadMobileDrawer().then((m) => ({ default: m.MobileDrawer }))
)
export const LazyToastRegion = lazy(() =>
  loadToastRegion().then((m) => ({ default: m.ToastRegion }))
)
