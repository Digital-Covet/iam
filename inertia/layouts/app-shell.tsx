import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from 'react'
import { usePage } from '@inertiajs/react'
import { ChevronRight, Menu, Moon, Search, Sun } from 'lucide-react'
import { FlashToaster } from '~/components/flash-toaster'
import { SidebarContent } from '~/components/sidebar'
import { useCommandHotkey } from '~/hooks/use-command-hotkey'
import { useSidebarRail } from '~/hooks/use-sidebar-rail'
import { useTheme } from '~/hooks/use-theme'
import { isActivePath, navGroups } from '~/lib/navigation'
import { LazyCommandPalette, LazyMobileDrawer, preloadMobileDrawer } from '~/lib/lazy'
import { cn } from '~/lib/utils'

/** "Group / Page" trail derived from the nav map; renders nothing for non-nav routes. */
function Breadcrumb({ url }: { url: string }) {
  for (const group of navGroups) {
    const item = group.items.find((i) => isActivePath(url, i.href))
    if (item) {
      return (
        <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-2 text-sm md:flex">
          <span className="font-mono text-xs text-muted-foreground">{group.label}</span>
          <ChevronRight size={14} aria-hidden="true" className="text-muted-foreground" />
          <span className="truncate font-semibold" aria-current="page">
            {item.label}
          </span>
        </nav>
      )
    }
  }
  return null
}

export function AppShell({ children }: PropsWithChildren) {
  const { url } = usePage()
  const { theme, toggleTheme } = useTheme()
  const { rail, toggleRail } = useSidebarRail()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  // Lazy overlays mount on first use, then stay mounted so exit animations and state survive.
  const [drawerUsed, setDrawerUsed] = useState(false)
  const [paletteUsed, setPaletteUsed] = useState(false)

  const openCommand = useCallback(() => {
    setPaletteUsed(true)
    setCommandOpen(true)
  }, [])
  const toggleCommand = useCallback(() => {
    setPaletteUsed(true)
    setCommandOpen((open) => !open)
  }, [])
  const openDrawer = useCallback(() => {
    setDrawerUsed(true)
    setMobileOpen(true)
  }, [])

  const { isMac } = useCommandHotkey(toggleCommand)

  // After navigating from the drawer, close it and move focus to the page heading.
  useEffect(() => {
    if (!mobileOpen) return
    setMobileOpen(false)
    requestAnimationFrame(() => document.querySelector<HTMLElement>('#main-content h1')?.focus())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only z-60 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to main content
      </a>

      <aside
        className={cn(
          'spine-edge fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-sidebar transition-[width] duration-180 motion-reduce:transition-none md:flex',
          rail ? 'w-16' : 'w-64'
        )}
      >
        <SidebarContent
          rail={rail}
          isMac={isMac}
          onToggleRail={toggleRail}
          onOpenCommand={openCommand}
        />
      </aside>

      <div
        className={cn(
          'min-h-dvh transition-[padding] duration-180 motion-reduce:transition-none',
          rail ? 'md:pl-16' : 'md:pl-64'
        )}
      >
        <header className="sticky top-0 z-20 folio-rule flex h-16 items-center justify-between gap-3 bg-background px-4 md:px-8">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={openDrawer}
            onPointerEnter={preloadMobileDrawer}
            onFocus={preloadMobileDrawer}
            className="grid size-10 place-items-center rounded-md hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:hidden"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <Breadcrumb url={url} />
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={openCommand}
              className="hidden h-10 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-sm text-muted-foreground transition-colors duration-140 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:flex"
            >
              <Search size={16} aria-hidden="true" />
              <span>Search</span>
              <kbd className="ml-4 rounded border border-border bg-background px-1.5 font-mono text-xs">
                {isMac ? '⌘K' : 'Ctrl K'}
              </kbd>
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors duration-140 hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {theme === 'dark' ? (
                <Sun size={18} aria-hidden="true" />
              ) : (
                <Moon size={18} aria-hidden="true" />
              )}
            </button>
          </div>
        </header>

        <main id="main-content" className="mx-auto w-full max-w-360 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>

      <Suspense fallback={null}>
        {drawerUsed && (
          <LazyMobileDrawer
            open={mobileOpen}
            onOpenChange={setMobileOpen}
            isMac={isMac}
            onOpenCommand={openCommand}
          />
        )}
        {paletteUsed && <LazyCommandPalette open={commandOpen} onOpenChange={setCommandOpen} />}
      </Suspense>
      <FlashToaster />
    </div>
  )
}

/**
 * Inertia persistent layout: `Page.layout = withAppShell`.
 * Must stay an arrow function: Inertia v3 treats any function with a
 * `.prototype` (i.e. a `function` declaration) as a layout *component* and
 * would pass it the page props instead of the page element.
 */
export const withAppShell = (page: ReactNode) => <AppShell>{page}</AppShell>
