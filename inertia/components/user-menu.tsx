import { router, usePage } from '@inertiajs/react'
import { Menu } from '@base-ui/react/menu'
import { ChevronsUpDown, LogOut, Moon, Sun, UserRound } from 'lucide-react'
import { useTheme } from '~/hooks/use-theme'
import { cn, initialsOf } from '~/lib/utils'

const item =
  'flex h-10 cursor-pointer items-center gap-3 rounded-md px-3 text-sm outline-none data-highlighted:bg-primary/10 data-highlighted:text-primary'

/** Account block for the sidebar footer. In the icon rail it collapses to the avatar. */
export function UserMenu({ rail = false }: { rail?: boolean }) {
  const { user, roleName } = usePage().props
  const { theme, toggleTheme } = useTheme()
  if (!user) return null

  const initials = user.initials || initialsOf(user.name, user.email)
  const display = user.name ?? user.email

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={rail ? `Account menu, ${display}` : 'Account menu'}
        className={cn(
          'flex h-14 w-full items-center gap-3 rounded-md px-2 text-left text-sm hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          rail && 'justify-center px-0'
        )}
      >
        <span className="stamp grid size-9 shrink-0 place-items-center rounded-lg text-xs font-semibold text-primary">
          {initials}
        </span>
        {!rail && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{display}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {roleName ? <span className="capitalize">{roleName}</span> : user.email}
              </span>
            </span>
            <ChevronsUpDown
              size={16}
              aria-hidden="true"
              className="shrink-0 text-muted-foreground"
            />
          </>
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          side={rail ? 'right' : 'top'}
          align={rail ? 'end' : 'start'}
          sideOffset={8}
          className="z-50"
        >
          <Menu.Popup className="w-64 rounded-2xl border border-border bg-surface-raised p-2 shadow-float outline-none transition-opacity duration-140 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none">
            <div className="border-b border-border px-3 py-2">
              <p className="truncate text-sm font-medium">{display}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              {roleName && (
                <p className="mt-1 text-xs text-muted-foreground capitalize">{roleName}</p>
              )}
            </div>
            <div className="pt-2">
              <Menu.Item className={item} onClick={() => router.visit('/account-settings')}>
                <UserRound size={18} aria-hidden="true" /> Account settings
              </Menu.Item>
              <Menu.Item className={item} closeOnClick={false} onClick={toggleTheme}>
                {theme === 'dark' ? (
                  <Sun size={18} aria-hidden="true" />
                ) : (
                  <Moon size={18} aria-hidden="true" />
                )}
                {theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              </Menu.Item>
              <Menu.Item className={item} onClick={() => router.post('/logout')}>
                <LogOut size={18} aria-hidden="true" /> Sign out
              </Menu.Item>
            </div>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
