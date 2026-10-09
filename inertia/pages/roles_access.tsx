import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Field } from '@base-ui/react/field'
import { Input } from '@base-ui/react/input'
import { Head, router } from '@inertiajs/react'
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { Checkbox } from '@base-ui/react/checkbox'
import { Collapsible } from '@base-ui/react/collapsible'
import { Dialog } from '@base-ui/react/dialog'
import { Tabs } from '@base-ui/react/tabs'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  Loader2,
  Lock,
  Plus,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import { EmptyState } from '~/components/empty-state'
import { ConfirmDialog } from '~/components/directory/confirm-dialog'
import { Button, buttonVariants } from '~/components/ui/button'
import { CheckBox } from '~/components/directory/shared'
import { dialogBackdrop, fieldClass, focusRing, SelectField } from '~/components/directory/shared'
import { PageHeader } from '~/components/page-header'
import { usePermissions } from '~/hooks/use-permissions'
import { withAppShell } from '~/layouts/app-shell'
import { cn } from '~/lib/utils'

type Role = {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  userCount: number
  permissionKeys: string[]
  updatedAt: string | null
}

type Permission = { id: string; key: string; section: string; description: string | null }
type Section = { key: string; label: string; permissions: Permission[] }

type Props = {
  roles: Role[]
  sections: Section[]
  totalPermissions: number
  /** Latest role `updatedAt` at read time; sent back for conflict detection. */
  baseUpdatedAt: string | null
  canCreateRole: boolean
  canSave: boolean
}

type Change = { role: Role; permission: Permission; from: boolean; to: boolean }

const nf = new Intl.NumberFormat('en-US')

/**
 * UI hints only; the server re-checks everything. Keep in step with
 * SUPERADMIN_ONLY_KEYS in app/services/access_service.ts.
 */
const SUPERADMIN_ONLY = new Set([
  'roles.create',
  'roles.delete',
  'apps.create',
  'apps.update',
  'apps.delete',
  'oauth.clients.manage',
  'settings.password_policy.update',
  'settings.auth_methods.update',
])

/** Changes to these get a before → after review step: role editing, OAuth clients, session revocation. */
const SENSITIVE = new Set([...SUPERADMIN_ONLY, 'roles.update', 'sessions.revoke'])

const isSuperadminRole = (role: Role) => role.name.toLowerCase() === 'superadmin'

function roleLabel(name: string) {
  const text = name.replace(/[_-]+/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const permLabel = (p: Permission) => p.description ?? p.key
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)

type MatrixRow =
  | { kind: 'section'; id: string; section: Section }
  | { kind: 'permission'; id: string; section: Section; permission: Permission }

const cellKey = (roleId: string, key: string) => `${roleId}|${key}`

/** Paper tint for group rows and headers, shared with the Directory table header. */
const groupTint = 'bg-[color-mix(in_oklab,var(--background)_55%,var(--surface))]'

/** One checkbox in the lattice. A narrow primary marker + "unsaved" in the name flag a draft change. */
function GrantCheckbox({
  checked,
  onChange,
  disabled,
  dirty,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  disabled: boolean
  dirty: boolean
  label: string
}) {
  return (
    <label
      className={cn(
        'relative flex h-11 w-full min-w-11 items-center justify-center',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer'
      )}
    >
      {dirty && (
        <>
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-primary/8" />
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-[3px] bg-primary pointer-events-none"
          />
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[3px] bg-primary pointer-events-none"
          />
        </>
      )}
      <Checkbox.Root
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => onChange(next)}
        aria-label={dirty ? `${label}, unsaved change` : label}
        className={cn(
          'grid size-5 place-items-center rounded-[5px] border border-border-strong bg-surface text-primary-foreground outline-none',
          'data-checked:border-primary data-checked:bg-primary data-disabled:opacity-60',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
        )}
      >
        <Checkbox.Indicator className="grid place-items-center data-unchecked:hidden">
          <Check size={14} strokeWidth={3} aria-hidden="true" />
        </Checkbox.Indicator>
      </Checkbox.Root>
    </label>
  )
}

function SuperadminOnlyTag() {
  return (
    <span className="stamp-chip text-muted-foreground">
      <Lock size={12} aria-hidden="true" />
      Superadmin only
    </span>
  )
}

function Legend() {
  return (
    <ul
      aria-label="Legend"
      className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
    >
      <li className="flex items-center gap-2">
        <span aria-hidden="true">
          <CheckBox
            checked
            onCheckedChange={() => {}}
            disabled
            className="data-disabled:opacity-100"
          />
        </span>
        Allowed
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true">
          <CheckBox
            checked={false}
            onCheckedChange={() => {}}
            disabled
            className="data-disabled:opacity-100"
          />
        </span>
        Not allowed
      </li>
      <li className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="relative size-5 border-t-[3px] border-l-[3px] border-t-primary border-l-primary bg-primary/8"
        />
        Unsaved change
      </li>
      <li className="flex items-center gap-2">
        <Lock size={14} aria-hidden="true" />
        Locked, or superadmin only
      </li>
    </ul>
  )
}

function RoleSummaryCard({
  role,
  granted,
  total,
  unsaved,
}: {
  role: Role
  granted: number
  total: number
  unsaved: number
}) {
  const locked = isSuperadminRole(role)
  return (
    <li className="p-5 max-md:not-first:border-t max-md:not-first:border-border md:min-w-56 md:not-first:perforated md:px-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{roleLabel(role.name)}</h2>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
            {role.description || (role.isSystem ? 'Built-in role' : 'Custom role')}
          </p>
        </div>
        {locked && (
          <span className="stamp-chip shrink-0 text-muted-foreground">
            <Lock size={14} aria-hidden="true" />
            Locked
          </span>
        )}
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <ShieldCheck size={14} aria-hidden="true" />
            Permissions
          </dt>
          <dd className="mt-1.5 tabular-nums">
            <span className="figure text-[1.75rem] leading-none">{nf.format(granted)}</span>
            <span className="text-muted-foreground"> of {nf.format(total)}</span>
            {unsaved > 0 && <span className="ml-1.5 text-primary">· unsaved</span>}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <Users size={14} aria-hidden="true" />
            Users
          </dt>
          <dd className="mt-1.5">
            <span className="figure text-[1.75rem] leading-none">{nf.format(role.userCount)}</span>
          </dd>
        </div>
      </dl>
    </li>
  )
}

function NewRoleDialog({
  open,
  onOpenChange,
  roles,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  roles: Role[]
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [template, setTemplate] = useState('none')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState(false)

  // Reset each time the dialog opens (render-time, not an effect).
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setName('')
      setDescription('')
      setTemplate('none')
      setErrors({})
    }
  }

  const templateOptions = [
    { value: 'none', label: 'Start with no permissions' },
    ...roles.map((r) => ({ value: r.id, label: `Copy from ${roleLabel(r.name)}` })),
  ]

  function submit(e: FormEvent) {
    e.preventDefault()
    if (processing) return
    setProcessing(true)
    setErrors({})
    router.post(
      '/roles-access',
      {
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(template !== 'none' ? { templateRoleId: template } : {}),
      },
      {
        preserveScroll: true,
        preserveState: true,
        onSuccess: (page) => {
          // The server redirects back even when it refuses (duplicate name); keep the dialog open.
          if (!page.flash?.error) onOpenChange(false)
        },
        onError: (errs) => setErrors(errs),
        onFinish: () => setProcessing(false),
      }
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className={dialogBackdrop} />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface-raised p-6 shadow-float transition-[opacity,translate] duration-180 data-ending-style:opacity-0 data-starting-style:-translate-y-[calc(50%+8px)] data-starting-style:opacity-0 motion-reduce:transition-none">
          <div className="ledger-rule flex items-start justify-between gap-3 pb-4">
            <div>
              <Dialog.Title className="text-xl leading-tight font-semibold">New role</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Create a custom role, then fine-tune it in the matrix.
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close"
              className={cn(
                'grid size-10 shrink-0 place-items-center rounded-md hover:bg-hover',
                focusRing
              )}
            >
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <form onSubmit={submit} noValidate className="mt-5 space-y-5">
            <Field.Root className="space-y-1.5">
              <Field.Label className="text-sm font-medium">Name</Field.Label>
              <Input
                required
                maxLength={50}
                autoComplete="off"
                value={name}
                onValueChange={setName}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby="role-name-help"
                placeholder="e.g. support"
                className={fieldClass}
              />
              <p id="role-name-help" className="text-sm text-muted-foreground">
                2–50 characters. Stored in lowercase.
              </p>
              {errors.name && <p className="text-sm text-error">{errors.name}</p>}
            </Field.Root>

            <Field.Root className="space-y-1.5">
              <Field.Label className="text-sm font-medium">Description (optional)</Field.Label>
              <Input
                maxLength={254}
                autoComplete="off"
                value={description}
                onValueChange={setDescription}
                aria-invalid={errors.description ? true : undefined}
                className={fieldClass}
              />
              {errors.description && <p className="text-sm text-error">{errors.description}</p>}
            </Field.Root>

            <SelectField
              label="Starting permissions"
              value={template}
              onValueChange={setTemplate}
              options={templateOptions}
            />

            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Dialog.Close className={buttonVariants.secondary}>Cancel</Dialog.Close>
              <Button
                type="submit"
                disabled={processing || name.trim().length < 2}
                variant="primary"
              >
                {processing ? (
                  <>
                    <Loader2
                      size={18}
                      aria-hidden="true"
                      className="animate-spin motion-reduce:animate-none"
                    />
                    Creating…
                  </>
                ) : (
                  'Create role'
                )}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default function RolesAccess({
  roles,
  sections,
  totalPermissions,
  baseUpdatedAt,
  canCreateRole,
  canSave,
}: Props) {
  const { isSuperadmin } = usePermissions()

  // Draft = only the cells the person has toggled, keyed roleId|permissionKey → desired value.
  // Comparing against the live server state means a reload merges cleanly: cells the
  // server already matches simply stop counting as changes.
  const [draft, setDraft] = useState<Record<string, boolean>>({})
  const [editBase, setEditBase] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [saving, setSaving] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [newRoleOpen, setNewRoleOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [activeRole, setActiveRole] = useState<string>(roles[0]?.id ?? '')

  const granted = useMemo(
    () => new Map(roles.map((r) => [r.id, new Set(r.permissionKeys)])),
    [roles]
  )

  const isGranted = (role: Role, key: string) => {
    const desired = draft[cellKey(role.id, key)]
    return desired ?? (isSuperadminRole(role) || (granted.get(role.id)?.has(key) ?? false))
  }

  const changes = useMemo<Change[]>(() => {
    const out: Change[] = []
    for (const role of roles) {
      if (isSuperadminRole(role)) continue
      for (const section of sections) {
        for (const permission of section.permissions) {
          const desired = draft[cellKey(role.id, permission.key)]
          if (desired === undefined) continue
          const from = granted.get(role.id)?.has(permission.key) ?? false
          if (desired !== from) out.push({ role, permission, from, to: desired })
        }
      }
    }
    return out
  }, [roles, sections, draft, granted])

  const dirtyCount = changes.length
  const dirtyCells = useMemo(
    () => new Set(changes.map((c) => cellKey(c.role.id, c.permission.key))),
    [changes]
  )
  const sensitiveChanges = changes.filter((c) => SENSITIVE.has(c.permission.key))

  // Someone else saved while this person had edits open: the props reloaded underneath them.
  if (dirtyCount > 0 && editBase !== null && editBase !== baseUpdatedAt) {
    setEditBase(baseUpdatedAt)
    setConflict(true)
  }

  // Guard route exits while edits are unsaved.
  useEffect(() => {
    if (dirtyCount === 0) return
    const off = router.on('before', (event) => {
      if (event.detail.visit.method !== 'get') return
      return window.confirm('You have unsaved permission changes. Leave without saving?')
    })
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onUnload)
    return () => {
      off()
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [dirtyCount])

  const editable = canSave
  const cellLocked = (role: Role, key: string) =>
    !editable || saving || isSuperadminRole(role) || (SUPERADMIN_ONLY.has(key) && !isSuperadmin)

  function toggle(role: Role, key: string, next: boolean) {
    setEditBase((b) => b ?? baseUpdatedAt)
    setDraft((d) => ({ ...d, [cellKey(role.id, key)]: next }))
  }

  function discard() {
    setDraft({})
    setEditBase(null)
    setConflict(false)
  }

  function save() {
    const byRole = new Map<string, Role>()
    for (const c of changes) byRole.set(c.role.id, c.role)
    const grants = [...byRole.values()].map((role) => ({
      roleId: role.id,
      permissionKeys: sections
        .flatMap((s) => s.permissions)
        .filter((p) => isGranted(role, p.key))
        .map((p) => p.key),
    }))
    setSaving(true)
    router.patch(
      '/roles-access/matrix',
      { grants, baseUpdatedAt: editBase ?? baseUpdatedAt },
      {
        preserveScroll: true,
        preserveState: true,
        onSuccess: (page) => {
          // The server redirects back even when it refuses; keep the draft so nothing is lost.
          if (page.flash?.error) return
          setDraft({})
          setEditBase(null)
          setConflict(false)
          setAnnounce('Changes saved')
        },
        onFinish: () => setSaving(false),
      }
    )
  }

  function requestSave() {
    setAnnounce('')
    if (sensitiveChanges.length > 0) setReviewOpen(true)
    else save()
  }

  function toggleSection(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const allCollapsed = collapsed.size === sections.length
  const countFor = (role: Role, perms: Permission[]) =>
    perms.filter((p) => isGranted(role, p.key)).length

  const roleSummaries = roles.map((role) => {
    const all = sections.flatMap((s) => s.permissions)
    return {
      role,
      granted: countFor(role, all),
      unsaved: changes.filter((c) => c.role.id === role.id).length,
    }
  })

  // Role × permission matrix. Section headers and permissions share one flat row
  // model so collapsing a section just removes its permission rows.
  const matrixRows = useMemo<MatrixRow[]>(
    () =>
      sections.flatMap((section) => [
        { kind: 'section' as const, id: `s:${section.key}`, section },
        ...(collapsed.has(section.key)
          ? []
          : section.permissions.map((permission) => ({
              kind: 'permission' as const,
              id: `p:${permission.key}`,
              section,
              permission,
            }))),
      ]),
    [sections, collapsed]
  )

  const matrixColumns: ColumnDef<MatrixRow>[] = [
    {
      id: 'permission',
      header: 'Permission',
      cell: ({ row: { original: r } }) => {
        if (r.kind === 'section') {
          const open = !collapsed.has(r.section.key)
          return (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => toggleSection(r.section.key)}
              className={cn(
                'font-display flex h-11 w-full items-center gap-2 px-4 text-[0.9375rem] font-medium',
                focusRing
              )}
            >
              {open ? (
                <ChevronDown size={16} aria-hidden="true" />
              ) : (
                <ChevronRight size={16} aria-hidden="true" />
              )}
              {r.section.label}
              <span className="font-normal text-muted-foreground tabular-nums">
                ({r.section.permissions.length})
              </span>
            </button>
          )
        }
        return (
          <>
            <span className="block font-medium">{permLabel(r.permission)}</span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <code className="font-mono text-xs text-muted-foreground">{r.permission.key}</code>
              {SUPERADMIN_ONLY.has(r.permission.key) && <SuperadminOnlyTag />}
            </span>
          </>
        )
      },
    },
    ...roles.map<ColumnDef<MatrixRow>>((role) => ({
      id: `role:${role.id}`,
      header: () => (
        <>
          <span className="block">{roleLabel(role.name)}</span>
          <span className="block text-xs font-normal text-muted-foreground tabular-nums">
            {isSuperadminRole(role) ? (
              <span className="inline-flex items-center gap-1">
                <Lock size={12} aria-hidden="true" />
                Always full access
              </span>
            ) : (
              `${nf.format(role.userCount)} ${role.userCount === 1 ? 'user' : 'users'}`
            )}
          </span>
        </>
      ),
      cell: ({ row: { original: r } }) =>
        r.kind === 'section' ? (
          `${countFor(role, r.section.permissions)} of ${r.section.permissions.length}`
        ) : (
          <GrantCheckbox
            checked={isGranted(role, r.permission.key)}
            disabled={cellLocked(role, r.permission.key)}
            dirty={dirtyCells.has(cellKey(role.id, r.permission.key))}
            onChange={(next) => toggle(role, r.permission.key, next)}
            label={`Allow ${roleLabel(role.name).toLowerCase()} to ${lowerFirst(permLabel(r.permission))}`}
          />
        ),
    })),
  ]

  const matrix = useReactTable({
    data: matrixRows,
    columns: matrixColumns,
    getRowId: (r) => r.id,
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <>
      <Head title="Roles & access" />
      <PageHeader
        title="Roles & access"
        description="Choose which permissions each role grants. Changes stay as a draft until you save."
        actions={
          canCreateRole && (
            <Button variant="primary" onClick={() => setNewRoleOpen(true)}>
              <Plus size={18} aria-hidden="true" />
              New role
            </Button>
          )
        }
      />

      {!canSave && (
        <p
          role="note"
          className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm"
        >
          <Info size={16} aria-hidden="true" className="shrink-0 text-info" />
          You can view permissions, but cannot edit them.
        </p>
      )}

      {conflict && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-3 rounded-lg border border-accent/40 bg-accent/10 p-4 text-sm"
        >
          <AlertTriangle size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
          <p className="flex-1">
            <span className="font-semibold text-accent">Permissions changed elsewhere.</span> The
            matrix now shows the latest saved state with your pending edits on top. Review the
            marked cells, then save again or discard.
          </p>
        </div>
      )}

      <ul
        aria-label="Roles"
        className="mb-6 grid grid-cols-1 overflow-hidden rounded-xl border border-border bg-surface shadow-card md:auto-cols-fr md:grid-flow-col md:overflow-x-auto"
      >
        {roleSummaries.map(({ role, granted: g, unsaved }) => (
          <RoleSummaryCard
            key={role.id}
            role={role}
            granted={g}
            total={totalPermissions}
            unsaved={unsaved}
          />
        ))}
      </ul>

      {sections.length === 0 || roles.length === 0 ? (
        <section className="rounded-xl border border-border bg-surface shadow-card">
          <EmptyState
            icon={ShieldCheck}
            title="No permissions to show"
            description="The permission catalogue is empty. Run the IAM seeder to populate it."
          />
        </section>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Legend />
            <Button
              variant="secondary"
              onClick={() =>
                setCollapsed(allCollapsed ? new Set() : new Set(sections.map((s) => s.key)))
              }
              className="h-10"
            >
              {allCollapsed ? 'Expand all groups' : 'Collapse all groups'}
            </Button>
          </div>

          {/* Desktop / tablet: role × permission matrix */}
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface shadow-card md:block">
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
              <caption className="sr-only">
                Permissions granted to each role. Use the checkboxes to change a grant.
              </caption>
              <thead>
                {matrix.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => (
                      <th
                        key={header.id}
                        scope="col"
                        className={cn(
                          'ledger-head',
                          header.column.id === 'permission'
                            ? 'sticky left-0 z-20 w-[300px] min-w-[240px] bg-surface px-4 py-3 text-left font-semibold'
                            : 'min-w-[120px] px-3 py-3 text-center font-semibold'
                        )}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {matrix.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => {
                      const isSection = row.original.kind === 'section'
                      const isFirst = cell.column.id === 'permission'
                      const content = flexRender(cell.column.columnDef.cell, cell.getContext())
                      if (isFirst) {
                        return (
                          <th
                            key={cell.id}
                            scope={isSection ? 'rowgroup' : 'row'}
                            className={cn(
                              'sticky left-0 z-10 border-b border-border text-left',
                              isSection ? cn(groupTint, 'p-0') : 'bg-surface px-4 py-2 font-normal'
                            )}
                          >
                            {content}
                          </th>
                        )
                      }
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            'border-b border-border',
                            isSection
                              ? cn(groupTint, 'px-3 text-center text-muted-foreground tabular-nums')
                              : 'px-0'
                          )}
                        >
                          {content}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: one role at a time */}
          <Tabs.Root
            value={activeRole}
            onValueChange={(v) => setActiveRole(String(v))}
            className="md:hidden"
          >
            <Tabs.List
              aria-label="Role"
              className="mb-3 flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1"
            >
              {roles.map((role) => (
                <Tabs.Tab
                  key={role.id}
                  value={role.id}
                  className={cn(
                    'h-10 shrink-0 rounded-md px-4 text-sm font-medium text-muted-foreground data-active:bg-primary/10 data-active:text-primary',
                    focusRing
                  )}
                >
                  {roleLabel(role.name)}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            {roles.map((role) => (
              <Tabs.Panel key={role.id} value={role.id} className="space-y-3 outline-none">
                {isSuperadminRole(role) && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Lock size={14} aria-hidden="true" />
                    Superadmin always has every permission.
                  </p>
                )}
                {sections.map((section) => {
                  const open = !collapsed.has(section.key)
                  return (
                    <Collapsible.Root
                      key={section.key}
                      open={open}
                      onOpenChange={(next) => {
                        setCollapsed((prev) => {
                          const s = new Set(prev)
                          if (next) s.delete(section.key)
                          else s.add(section.key)
                          return s
                        })
                      }}
                      className="overflow-hidden rounded-xl border border-border bg-surface"
                    >
                      <h3>
                        <Collapsible.Trigger
                          className={cn(
                            'font-display flex h-11 w-full items-center gap-2 px-4 text-[0.9375rem] font-medium',
                            groupTint,
                            focusRing
                          )}
                        >
                          {open ? (
                            <ChevronDown size={16} aria-hidden="true" />
                          ) : (
                            <ChevronRight size={16} aria-hidden="true" />
                          )}
                          {section.label}
                          <span className="ml-auto font-normal text-muted-foreground tabular-nums">
                            {countFor(role, section.permissions)} of {section.permissions.length}
                          </span>
                        </Collapsible.Trigger>
                      </h3>
                      <Collapsible.Panel>
                        <ul>
                          {section.permissions.map((permission) => (
                            <li
                              key={permission.key}
                              className="flex items-center gap-2 border-t border-border pr-1 pl-4"
                            >
                              <div className="min-w-0 flex-1 py-2">
                                <p className="font-medium">{permLabel(permission)}</p>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <code className="font-mono text-xs break-all text-muted-foreground">
                                    {permission.key}
                                  </code>
                                  {SUPERADMIN_ONLY.has(permission.key) && <SuperadminOnlyTag />}
                                </div>
                              </div>
                              <div className="w-14 shrink-0">
                                <GrantCheckbox
                                  checked={isGranted(role, permission.key)}
                                  disabled={cellLocked(role, permission.key)}
                                  dirty={dirtyCells.has(cellKey(role.id, permission.key))}
                                  onChange={(next) => toggle(role, permission.key, next)}
                                  label={`Allow ${roleLabel(role.name).toLowerCase()} to ${lowerFirst(permLabel(permission))}`}
                                />
                              </div>
                            </li>
                          ))}
                        </ul>
                      </Collapsible.Panel>
                    </Collapsible.Root>
                  )
                })}
              </Tabs.Panel>
            ))}
          </Tabs.Root>
        </>
      )}

      {/* Sits after the matrix in flow, so it never covers the last row. */}
      {dirtyCount > 0 && (
        <section
          aria-label="Unsaved changes"
          className="sticky bottom-4 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-raised p-4 shadow-float"
        >
          <p className="flex items-center gap-2 text-sm font-medium tabular-nums">
            <span
              aria-hidden="true"
              className="relative size-5 border-t-[3px] border-l-[3px] border-t-primary border-l-primary bg-primary/8"
            />
            {nf.format(dirtyCount)} unsaved {dirtyCount === 1 ? 'change' : 'changes'}
            {sensitiveChanges.length > 0 && (
              <span className="font-normal text-muted-foreground">
                · {nf.format(sensitiveChanges.length)} sensitive, review required
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={saving} onClick={discard}>
              Discard
            </Button>
            <Button variant="primary" disabled={saving} onClick={requestSave}>
              {saving ? (
                <>
                  <Loader2
                    size={18}
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />
                  Saving…
                </>
              ) : (
                'Save changes'
              )}
            </Button>
          </div>
        </section>
      )}

      <p role="status" className="sr-only">
        {announce}
      </p>

      <NewRoleDialog open={newRoleOpen} onOpenChange={setNewRoleOpen} roles={roles} />

      <ConfirmDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        title="Review sensitive changes"
        description={
          <>
            These changes affect who can manage roles, OAuth clients or sessions.
            {dirtyCount > sensitiveChanges.length &&
              ` ${nf.format(dirtyCount - sensitiveChanges.length)} other ${dirtyCount - sensitiveChanges.length === 1 ? 'change is' : 'changes are'} saved with them.`}
          </>
        }
        confirmLabel={`Save ${nf.format(dirtyCount)} ${dirtyCount === 1 ? 'change' : 'changes'}`}
        onConfirm={save}
      >
        <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
          {sensitiveChanges.map((c) => (
            <li
              key={cellKey(c.role.id, c.permission.key)}
              className="rounded-lg border border-border px-3 py-2"
            >
              <p className="font-medium">
                {roleLabel(c.role.name)} · {permLabel(c.permission)}
              </p>
              <p className="text-muted-foreground">
                {c.from ? 'Allowed' : 'Not allowed'} →{' '}
                <strong className="font-semibold text-foreground">
                  {c.to ? 'Allowed' : 'Not allowed'}
                </strong>
              </p>
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </>
  )
}

RolesAccess.layout = withAppShell
