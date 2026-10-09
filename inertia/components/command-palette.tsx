import { useMemo, useState } from 'react'
import { router } from '@inertiajs/react'
import { Autocomplete } from '@base-ui/react/autocomplete'
import { Dialog } from '@base-ui/react/dialog'
import { Moon, Search, Sun, UserPlus, UserRound, type LucideIcon } from 'lucide-react'
import { usePermissions } from '~/hooks/use-permissions'
import { useTheme } from '~/hooks/use-theme'
import { navGroups } from '~/lib/navigation'
import { cn } from '~/lib/utils'

type Command = { id: string; label: string; icon: LucideIcon; run: () => void }
type CommandGroup = { value: string; items: Command[] }

type Props = { open: boolean; onOpenChange: (open: boolean) => void }

/**
 * Permission-filtered "Jump to…" palette. Base UI Autocomplete inside Dialog
 * owns filtering, highlight and keyboard handling; selection only navigates
 * or opens forms, never runs anything destructive.
 */
export function CommandPalette({ open, onOpenChange }: Props) {
  const { satisfies, can } = usePermissions()
  const { theme, toggleTheme } = useTheme()
  const [query, setQuery] = useState('')

  const grouped = useMemo<CommandGroup[]>(() => {
    const go = (href: string) => () => router.visit(href)
    const goto: Command[] = []
    for (const group of navGroups) {
      for (const item of group.items) {
        if (satisfies(item.requires)) {
          goto.push({
            id: item.href,
            label: `Go to ${item.label}`,
            icon: item.icon,
            run: go(item.href),
          })
        }
      }
    }
    goto.push({
      id: '/account-settings',
      label: 'Go to Account settings',
      icon: UserRound,
      run: go('/account-settings'),
    })
    const actions: Command[] = []
    if (can('users.create')) {
      actions.push({
        id: 'invite',
        label: 'Invite user',
        icon: UserPlus,
        run: go('/?invite=1'),
      })
    }
    actions.push({
      id: 'theme',
      label: 'Toggle theme',
      icon: theme === 'dark' ? Sun : Moon,
      run: toggleTheme,
    })
    return [
      { value: 'Go to…', items: goto },
      { value: 'Actions', items: actions },
    ]
  }, [satisfies, can, theme, toggleTheme])

  function choose(cmd: Command | null | undefined) {
    if (!cmd) return
    onOpenChange(false)
    setQuery('')
    cmd.run()
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setQuery('')
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-140 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none" />
        <Dialog.Popup
          aria-label="Jump to"
          className="fixed top-[15vh] left-1/2 z-50 flex max-h-[min(36rem,calc(100dvh-5rem))] w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-float transition-[opacity,translate] duration-180 data-ending-style:opacity-0 data-starting-style:-translate-y-2 data-starting-style:opacity-0 motion-reduce:transition-none"
        >
          <Dialog.Title className="sr-only">Jump to</Dialog.Title>
          <Autocomplete.Root
            open
            inline
            items={grouped}
            value={query}
            onValueChange={setQuery}
            autoHighlight="always"
            keepHighlight
            filter={(item, q) =>
              (item as Command).label.toLowerCase().includes(q.trim().toLowerCase())
            }
            itemToStringValue={(item) => (item as Command).label}
          >
            <Autocomplete.InputGroup className="flex items-center gap-3 border-b border-border px-4">
              <Search size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />
              <Autocomplete.Input
                autoFocus
                aria-label="Search destinations and actions"
                placeholder="Search destinations and actions"
                className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
            </Autocomplete.InputGroup>
            <Dialog.Close className="sr-only">Close</Dialog.Close>
            <div className="max-h-80 min-h-0 flex-1 overflow-y-auto p-2">
              <Autocomplete.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
                No matching commands.
              </Autocomplete.Empty>
              <Autocomplete.List className="outline-none">
                {(group: CommandGroup) => (
                  <Autocomplete.Group key={group.value} items={group.items}>
                    <Autocomplete.GroupLabel className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {group.value}
                    </Autocomplete.GroupLabel>
                    <Autocomplete.Collection>
                      {(cmd: Command) => {
                        const Icon = cmd.icon
                        return (
                          <Autocomplete.Item
                            key={cmd.id}
                            value={cmd}
                            onClick={() => choose(cmd)}
                            className={cn(
                              'flex h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm outline-none',
                              'data-highlighted:bg-primary/10 data-highlighted:text-primary'
                            )}
                          >
                            <Icon size={18} aria-hidden="true" />
                            {cmd.label}
                          </Autocomplete.Item>
                        )
                      }}
                    </Autocomplete.Collection>
                  </Autocomplete.Group>
                )}
              </Autocomplete.List>
            </div>
          </Autocomplete.Root>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
