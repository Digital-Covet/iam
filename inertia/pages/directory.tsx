import { useEffect, useState } from 'react'
import { Field } from '@base-ui/react/field'
import { Input } from '@base-ui/react/input'
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { Head, router, usePage } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import { Menu } from '@base-ui/react/menu'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  MailPlus,
  MoreHorizontal,
  Search,
  ShieldOff,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { EmptyState } from '~/components/empty-state'
import { ConfirmDialog } from '~/components/directory/confirm-dialog'
import { InviteDialog } from '~/components/directory/invite-dialog'
import { UserSheet } from '~/components/directory/user-sheet'
import { Button, buttonVariants } from '~/components/ui/button'
import { TextAreaField } from '~/components/ui/field'
import {
  Avatar,
  Stamp,
  StatusBadge,
  displayName,
  SelectField,
  TwoFactorBadge,
  fieldClass,
  focusRing,
  mutate,
  type AppOption,
  type DirectoryUser,
  type RoleOption,
} from '~/components/directory/shared'
import { DataTable } from '~/components/data-table'
import { PageHeader } from '~/components/page-header'
import { withAppShell } from '~/layouts/app-shell'
import { usePermissions } from '~/hooks/use-permissions'
import { cn } from '~/lib/utils'

type SortKey = 'name' | 'email' | 'createdAt' | 'updatedAt' | 'lastActive'

type Filters = {
  search: string
  role: string
  status: string
  app: string
  sort: SortKey
  direction: 'asc' | 'desc'
}

type Props = {
  users: DirectoryUser[]
  meta: { total: number; perPage: number; currentPage: number; lastPage: number }
  filters: Filters
  roles: RoleOption[]
  apps: AppOption[]
}

type RowAction =
  { kind: 'suspend'; user: DirectoryUser } | { kind: 'delete'; user: DirectoryUser } | null

const nf = new Intl.NumberFormat('en-US')
const SEARCH_DEBOUNCE_MS = 300

/** Filters live in the URL; defaults are omitted so shared links stay short. */
function toQuery(f: Partial<Filters>, page?: number) {
  const q: Record<string, string> = {}
  if (f.search) q.search = f.search
  if (f.role && f.role !== 'all') q.role = f.role
  if (f.status && f.status !== 'all') q.status = f.status
  if (f.app && f.app !== 'all') q.app = f.app
  if (f.sort && f.sort !== 'name') q.sort = f.sort
  if (f.direction && f.direction !== 'asc') q.direction = f.direction
  if (page && page > 1) q.page = String(page)
  return q
}

function href(f: Partial<Filters>, page?: number) {
  const qs = new URLSearchParams(toQuery(f, page)).toString()
  return qs ? `/?${qs}` : '/'
}

const menuItem =
  'flex h-10 cursor-pointer items-center gap-3 rounded-md px-3 text-sm outline-none data-highlighted:bg-primary/10 data-highlighted:text-primary'

function RowMenu({
  user,
  isSelf,
  onView,
  onAction,
}: {
  user: DirectoryUser
  isSelf: boolean
  onView: () => void
  onAction: (action: NonNullable<RowAction>) => void
}) {
  const { can, isSuperadmin } = usePermissions()
  // Only superadmins may touch a superadmin; the server enforces it as well.
  const protectedTarget = user.roleName === 'superadmin' && !isSuperadmin
  const name = displayName(user)

  const items: {
    key: string
    label: string
    icon: LucideIcon
    danger?: boolean
    run: () => void
  }[] = []
  items.push({ key: 'view', label: 'View details', icon: Eye, run: onView })
  if (user.status === 'invited' && can('users.create')) {
    items.push({
      key: 'resend',
      label: 'Resend invitation',
      icon: MailPlus,
      run: () => mutate('post', `/directory/${user.id}/resend-invite`, undefined),
    })
  }
  if (can('users.update') && !protectedTarget) {
    if (user.status === 'suspended') {
      items.push({
        key: 'reactivate',
        label: 'Reactivate',
        icon: ShieldCheck,
        run: () => mutate('patch', `/directory/${user.id}/status`, { status: 'reactivate' }),
      })
    } else if (!isSelf) {
      items.push({
        key: 'suspend',
        label: 'Suspend…',
        icon: ShieldOff,
        run: () => onAction({ kind: 'suspend', user }),
      })
    }
  }
  if (can('users.delete') && !isSelf && !protectedTarget) {
    items.push({
      key: 'delete',
      label: 'Delete…',
      icon: Trash2,
      danger: true,
      run: () => onAction({ kind: 'delete', user }),
    })
  }

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Actions for ${name}`}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'grid size-10 place-items-center rounded-md text-muted-foreground hover:bg-hover hover:text-foreground',
          focusRing
        )}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={4} className="z-50">
          <Menu.Popup className="w-56 rounded-2xl border border-border bg-surface-raised p-2 shadow-float outline-none transition-opacity duration-140 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none">
            {items.map((item) => (
              <Menu.Item
                key={item.key}
                onClick={item.run}
                className={cn(
                  menuItem,
                  item.danger &&
                    'text-error data-highlighted:bg-error/10 data-highlighted:text-error'
                )}
              >
                <item.icon size={18} aria-hidden="true" />
                {item.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

function SortButton({
  label,
  column,
  filters,
  onSort,
}: {
  label: string
  column: SortKey
  filters: Filters
  onSort: (column: SortKey) => void
}) {
  const active = filters.sort === column
  const Icon = filters.direction === 'asc' ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={cn('inline-flex items-center gap-1.5 rounded-sm hover:text-foreground', focusRing)}
    >
      {label}
      {active && <Icon size={14} aria-hidden="true" />}
    </button>
  )
}
export default function Directory({ users, meta, filters, roles, apps }: Props) {
  const { can } = usePermissions()
  const page = usePage()
  const viewerId = page.props.user?.id
  const [search, setSearch] = useState(filters.search)
  const [loading, setLoading] = useState(false)
  const [sheetId, setSheetId] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [action, setAction] = useState<RowAction>(null)
  const [reason, setReason] = useState('')

  // The command palette links here with ?invite=1; react to each new URL once.
  const [seenUrl, setSeenUrl] = useState('')
  if (seenUrl !== page.url) {
    setSeenUrl(page.url)
    if (
      can('users.create') &&
      new URLSearchParams(page.url.split('?')[1] ?? '').get('invite') === '1'
    ) {
      setInviteOpen(true)
    }
  }

  function visit(next: Partial<Filters>, pageNumber?: number) {
    router.get(href({ ...filters, ...next }, pageNumber), undefined, {
      preserveState: true,
      preserveScroll: true,
      replace: true,
      onStart: () => setLoading(true),
      onFinish: () => setLoading(false),
    })
  }

  // Debounced search: write to the URL once typing pauses.
  useEffect(() => {
    const trimmed = search.trim()
    if (trimmed === filters.search) return
    const id = window.setTimeout(() => visit({ search: trimmed }), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const hasFilters =
    filters.search !== '' ||
    filters.role !== 'all' ||
    filters.status !== 'all' ||
    filters.app !== 'all'

  function clearFilters() {
    setSearch('')
    visit({ search: '', role: 'all', status: 'all', app: 'all' })
  }

  function onSort(column: SortKey) {
    const direction = filters.sort === column && filters.direction === 'asc' ? 'desc' : 'asc'
    visit({ sort: column, direction })
  }

  const exportHref = `/directory/export${
    Object.keys(toQuery({ ...filters, sort: 'name', direction: 'asc' })).length
      ? `?${new URLSearchParams(toQuery({ ...filters, sort: 'name', direction: 'asc' }))}`
      : ''
  }`

  const sheetUser = users.find((u) => u.id === sheetId) ?? null
  const from = meta.total === 0 ? 0 : (meta.currentPage - 1) * meta.perPage + 1
  const to = Math.min(meta.currentPage * meta.perPage, meta.total)

  function confirmAction() {
    if (!action) return
    if (action.kind === 'suspend')
      mutate('patch', `/directory/${action.user.id}/status`, {
        status: 'suspend',
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      })
    else mutate('delete', `/directory/${action.user.id}`, undefined)
  }

  const columns: ColumnDef<DirectoryUser>[] = [
    {
      id: 'name',
      accessorFn: (u) => displayName(u),
      header: () => <SortButton label="Name" column="name" filters={filters} onSort={onSort} />,
      cell: ({ row: { original: u } }) => (
        <div className="flex items-center gap-3">
          <Avatar user={u} />
          <div className="min-w-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setSheetId(u.id)
              }}
              className={cn(
                'block max-w-full truncate rounded-sm text-left font-medium hover:underline',
                focusRing
              )}
            >
              {displayName(u)}
            </button>
            <p className="truncate text-muted-foreground">
              {u.name ? u.email : 'Name not set'}
              <span className="md:hidden"> · {u.role?.name ?? 'No role'}</span>
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Role',
      meta: { className: 'hidden md:table-cell' },
      cell: ({ row: { original: u } }) =>
        u.role ? (
          <span className="rounded-md bg-hover px-2 py-0.5 text-[0.8125rem] font-medium">
            {u.role.name}
          </span>
        ) : (
          '—'
        ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'apps',
      header: 'App access',
      meta: { className: 'hidden lg:table-cell' },
      cell: ({ row: { original: u } }) => {
        const granted = apps.filter((a) => u.apps[a.slug])
        return granted.length === 0 ? (
          <span className="text-muted-foreground">None</span>
        ) : (
          <span>
            <span className="tabular-nums">
              {granted.length} of {apps.length}
            </span>
            <span className="text-muted-foreground">
              {' '}
              · {granted.map((a) => a.name).join(', ')}
            </span>
          </span>
        )
      },
    },
    {
      id: 'twoFactor',
      header: '2FA',
      meta: { className: 'hidden lg:table-cell' },
      cell: ({ row }) => <TwoFactorBadge enabled={row.original.twoFactorEnabled} />,
    },
    {
      id: 'lastActive',
      accessorFn: (u) => u.lastActive,
      header: () => (
        <SortButton label="Last active" column="lastActive" filters={filters} onSort={onSort} />
      ),
      meta: {
        className: 'hidden xl:table-cell',
        cellClassName: 'whitespace-nowrap text-muted-foreground',
      },
      cell: ({ row }) => <Stamp value={row.original.lastActive} />,
    },
    {
      id: 'createdAt',
      accessorFn: (u) => u.joined,
      header: () => (
        <SortButton label="Joined" column="createdAt" filters={filters} onSort={onSort} />
      ),
      meta: {
        className: 'hidden xl:table-cell',
        cellClassName: 'whitespace-nowrap text-muted-foreground',
      },
      cell: ({ row }) => <Stamp value={row.original.joined} day />,
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      meta: { className: 'w-14', cellClassName: 'px-2 text-right' },
      cell: ({ row: { original: u } }) => (
        <RowMenu
          user={u}
          isSelf={u.id === viewerId}
          onView={() => setSheetId(u.id)}
          onAction={(a) => {
            setReason('')
            setAction(a)
          }}
        />
      ),
    },
  ]

  // Sorting and paging happen on the server; TanStack only models the state.
  const table = useReactTable({
    data: users,
    columns,
    getRowId: (u) => u.id,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    state: { sorting: [{ id: filters.sort, desc: filters.direction === 'desc' }] },
  })
  return (
    <>
      <Head title="Directory" />
      <PageHeader
        title="Directory"
        description="Find people and manage their role, status and app access."
        actions={
          <>
            <a href={exportHref} download className={buttonVariants.secondary}>
              <Download size={18} aria-hidden="true" />
              Export CSV
            </a>
            {can('users.create') && (
              <Button variant="primary" onClick={() => setInviteOpen(true)}>
                <UserPlus size={18} aria-hidden="true" />
                Invite user
              </Button>
            )}
          </>
        }
      />

      <form
        role="search"
        aria-label="Filter users"
        onSubmit={(e) => e.preventDefault()}
        className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]"
      >
        <Field.Root className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <Field.Label className="block text-sm font-medium">Search</Field.Label>
          <div className="relative">
            <Search
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              autoComplete="off"
              spellCheck={false}
              placeholder="e.g. amara or @digitalcovet.com"
              value={search}
              onValueChange={setSearch}
              className={cn(fieldClass, 'pr-11 pl-10 [&::-webkit-search-cancel-button]:hidden')}
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch('')}
                className={cn(
                  'absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-muted-foreground hover:text-foreground',
                  focusRing
                )}
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </Field.Root>

        <SelectField
          label="Role"
          value={filters.role}
          onValueChange={(role) => visit({ role })}
          options={[
            { value: 'all', label: 'All roles' },
            ...roles.map((r) => ({ value: r.name, label: r.name })),
          ]}
        />

        <SelectField
          label="Status"
          value={filters.status}
          onValueChange={(status) => visit({ status })}
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'active', label: 'Active' },
            { value: 'invited', label: 'Invited' },
            { value: 'suspended', label: 'Suspended' },
          ]}
        />

        <SelectField
          label="App access"
          value={filters.app}
          onValueChange={(app) => visit({ app })}
          options={[
            { value: 'all', label: 'Any app' },
            ...apps.map((a) => ({ value: a.slug, label: a.name })),
          ]}
        />

        <div className="flex items-end">
          <Button
            variant="secondary"
            onClick={clearFilters}
            disabled={!hasFilters}
            className="w-full lg:w-auto"
          >
            Clear filters
          </Button>
        </div>
      </form>

      <p role="status" className="mb-2 text-sm text-muted-foreground tabular-nums">
        {meta.total === 0
          ? hasFilters
            ? 'No users match these filters.'
            : 'No users yet.'
          : `Showing ${nf.format(from)}–${nf.format(to)} of ${nf.format(meta.total)} ${meta.total === 1 ? 'user' : 'users'}`}
      </p>

      <section
        className="relative overflow-hidden rounded-xl border border-border bg-surface"
        aria-label="Users"
      >
        {loading && (
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 z-10 h-0.5 animate-pulse bg-primary motion-reduce:animate-none"
          />
        )}

        {users.length === 0 ? (
          <EmptyState
            icon={hasFilters ? Search : Users}
            title={hasFilters ? 'No users match these filters' : 'No users yet'}
            description={
              hasFilters
                ? 'Try a different search or remove a filter.'
                : can('users.create')
                  ? 'Invite the first person to give them access to Digital Covet apps.'
                  : 'People will appear here once they have been invited.'
            }
          >
            {hasFilters ? (
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : (
              can('users.create') && (
                <Button variant="primary" onClick={() => setInviteOpen(true)}>
                  <UserPlus size={18} aria-hidden="true" />
                  Invite user
                </Button>
              )
            )}
          </EmptyState>
        ) : (
          <DataTable
            table={table}
            onRowClick={(row) => setSheetId(row.original.id)}
            caption={`Users, sorted by ${
              filters.sort === 'createdAt'
                ? 'date joined'
                : filters.sort === 'lastActive'
                  ? 'last active'
                  : filters.sort
            } ${filters.direction === 'asc' ? 'ascending' : 'descending'}`}
          />
        )}
      </section>

      {meta.lastPage > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground tabular-nums">
            Page {meta.currentPage} of {meta.lastPage}
          </p>
          <div className="flex gap-2">
            <PageLink
              label="Previous"
              icon={ChevronLeft}
              to={meta.currentPage > 1 ? toQuery(filters, meta.currentPage - 1) : null}
            />
            <PageLink
              label="Next"
              icon={ChevronRight}
              iconAfter
              to={meta.currentPage < meta.lastPage ? toQuery(filters, meta.currentPage + 1) : null}
            />
          </div>
        </nav>
      )}

      <UserSheet
        user={sheetUser}
        roles={roles}
        viewerId={viewerId}
        onClose={() => setSheetId(null)}
      />
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} roles={roles} apps={apps} />

      <ConfirmDialog
        open={!!action}
        onOpenChange={(open) => !open && setAction(null)}
        destructive
        title={
          action?.kind === 'suspend'
            ? `Suspend ${action.user.email}?`
            : action
              ? `Delete ${action.user.email}?`
              : ''
        }
        description={
          action?.kind === 'suspend'
            ? 'They will be signed out of every device and cannot sign in until reactivated. Their app tokens are revoked.'
            : 'This removes the account from the directory, signs them out everywhere and revokes their app tokens. It cannot be undone from here.'
        }
        confirmLabel={action?.kind === 'suspend' ? 'Suspend user' : 'Delete user'}
        onConfirm={confirmAction}
      >
        {action?.kind === 'suspend' && (
          <TextAreaField
            label="Reason (optional)"
            value={reason}
            onValueChange={setReason}
            rows={3}
          />
        )}
      </ConfirmDialog>
    </>
  )
}

function PageLink({
  label,
  to,
  icon: Icon,
  iconAfter,
}: {
  label: string
  to: Record<string, string> | null
  icon: LucideIcon
  iconAfter?: boolean
}) {
  const content = (
    <>
      {!iconAfter && <Icon size={18} aria-hidden="true" />}
      {label}
      {iconAfter && <Icon size={18} aria-hidden="true" />}
    </>
  )
  if (!to) {
    return (
      <span
        aria-disabled="true"
        className={cn(
          buttonVariants.secondary,
          'cursor-not-allowed opacity-60 hover:bg-transparent'
        )}
      >
        {content}
      </span>
    )
  }
  return (
    <Link route="directory.index" qs={to} preserveState className={buttonVariants.secondary}>
      {content}
    </Link>
  )
}

Directory.layout = withAppShell
