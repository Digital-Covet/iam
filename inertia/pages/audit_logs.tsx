import { useEffect, useMemo, useState } from 'react'
import { Head, router } from '@inertiajs/react'
import { Dialog } from '@base-ui/react/dialog'
import { Field } from '@base-ui/react/field'
import { Input } from '@base-ui/react/input'
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import {
  Bell,
  CheckCircle2,
  CircleAlert,
  Download,
  Info,
  Loader2,
  ScrollText,
  Search,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react'
import { EmptyState } from '~/components/empty-state'
import { DataTable } from '~/components/data-table'
import { PageHeader } from '~/components/page-header'
import { Button, buttonVariants } from '~/components/ui/button'
import {
  Stamp,
  dialogBackdrop,
  fieldClass,
  focusRing,
  SelectField,
  stampFmt,
} from '~/components/directory/shared'
import { usePermissions } from '~/hooks/use-permissions'
import { withAppShell } from '~/layouts/app-shell'
import { cn, initialsOf } from '~/lib/utils'

type Actor = {
  id: string
  name: string | null
  email: string
  initials: string
  image: string | null
  displayName: string
}

type AuditEvent = {
  id: string
  action: string
  label: string
  status: string
  severity: Severity
  createdAt: string | null
  actor: Actor | null
  ip: string | null
  location: string | null
  resourceType: string | null
  resourceId: string | null
}

type Filters = {
  actor: string
  type: string
  status: string
  severity: string
  from: string
  to: string
}
type Meta = { total: number; nextCursor: string | null; hasMore: boolean; limit: number }

type Props = { events: AuditEvent[]; meta: Meta; filters: Filters }

type EventDetail = {
  id: string
  action: string
  label: string
  status: string
  severity: Severity
  createdAt: string | null
  ip: string | null
  location: string | null
  metadata: Record<string, unknown>
  resourceType: string | null
  resourceId: string | null
  actor: (Actor & { roleName: string | null }) | null
  related: { id: string; label: string; status: string; createdAt: string | null }[]
}

type Severity = 'critical' | 'notice' | 'info'

const nf = new Intl.NumberFormat('en-US')
const SEARCH_DEBOUNCE_MS = 300

const TYPE_OPTIONS = [
  { value: 'all', label: 'All events' },
  { value: 'sessions', label: 'Sessions' },
  { value: 'signins', label: 'Sign-ins' },
  { value: 'failed', label: 'Failed sign-ins' },
  { value: 'tokens', label: 'Tokens & OAuth' },
  { value: 'roles', label: 'Roles & access' },
  { value: 'violations', label: 'Policy violations' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'Any outcome' },
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failure' },
]

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'Any severity' },
  { value: 'critical', label: 'Critical' },
  { value: 'notice', label: 'Notice' },
  { value: 'info', label: 'Info' },
]

/** Info is the common case, so it stays quiet; notice and critical are stamped. */
const severityMeta: Record<
  Severity,
  { label: string; icon: LucideIcon; tone: string; stamped: boolean }
> = {
  critical: { label: 'Critical', icon: TriangleAlert, tone: 'text-error', stamped: true },
  notice: { label: 'Notice', icon: Bell, tone: 'text-warning', stamped: true },
  info: { label: 'Info', icon: Info, tone: 'text-muted-foreground', stamped: false },
}

function SeverityLabel({ severity }: { severity: Severity }) {
  const { label, icon: Icon, tone, stamped } = severityMeta[severity] ?? severityMeta.info
  return (
    <span className={cn(stamped ? 'stamp-chip' : 'inline-flex items-center gap-1.5 text-sm', tone)}>
      <Icon size={stamped ? 14 : 16} aria-hidden="true" />
      {label}
    </span>
  )
}

/** Exceptions (critical or non-success) get a wash and a rail; the labels still say why. */
const exceptionRow = 'bg-alert-wash [&>td:first-child]:shadow-[inset_3px_0_0_var(--alert-fill)]'

function Outcome({ status }: { status: string }) {
  const ok = status === 'success'
  const Icon = ok ? CheckCircle2 : CircleAlert
  return (
    <span className={cn('stamp-chip', ok ? 'text-success' : 'text-error')}>
      <Icon size={14} aria-hidden="true" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function ActorAvatar({ actor, size = 32 }: { actor: Actor | null; size?: number }) {
  const [broken, setBroken] = useState(false)
  const box = { width: size, height: size }
  if (actor?.image && !broken) {
    return (
      <img
        src={actor.image}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        style={box}
        className="stamp shrink-0 rounded-md object-contain p-0.5"
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...box, fontSize: size >= 48 ? 16 : 12 }}
      className="stamp grid shrink-0 place-items-center rounded-md font-semibold text-primary"
    >
      {actor ? actor.initials || initialsOf(actor.name, actor.email) : 'SY'}
    </span>
  )
}

function Target({ type, id }: { type: string | null; id: string | null }) {
  if (!type && !id) return <span className="text-muted-foreground">—</span>
  return (
    <span className="block min-w-0">
      {type && <span className="block truncate">{type}</span>}
      {id && (
        <span className="block truncate font-mono text-xs text-muted-foreground tabular-nums">
          {id}
        </span>
      )}
    </span>
  )
}

/** Filters live in the URL; defaults are omitted so shared links stay short. */
function toQuery(f: Partial<Filters>) {
  const q: Record<string, string> = {}
  if (f.actor) q.actor = f.actor
  if (f.type && f.type !== 'all') q.type = f.type
  if (f.status && f.status !== 'all') q.status = f.status
  if (f.severity && f.severity !== 'all') q.severity = f.severity
  if (f.from) q.from = f.from
  if (f.to) q.to = f.to
  return q
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right break-words">{children}</dd>
    </div>
  )
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function Inspector({ eventId, onClose }: { eventId: string | null; onClose: () => void }) {
  return <InspectorContent key={eventId ?? 'closed'} eventId={eventId} onClose={onClose} />
}

function InspectorContent({ eventId, onClose }: { eventId: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<EventDetail | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!eventId) return
    const controller = new AbortController()
    fetch(`/audit-logs/${eventId}`, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status))
        return res.json() as Promise<EventDetail>
      })
      .then((next) => {
        setDetail(next)
        setLoadError(false)
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') setLoadError(true)
      })
    return () => controller.abort()
  }, [eventId, attempt])

  // Secrets are already redacted by the server ("[redacted]").
  const metadata = detail
    ? Object.entries(detail.metadata).filter(([, value]) => value !== null && value !== '')
    : []

  return (
    <Dialog.Root open={!!eventId} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className={dialogBackdrop} />
        <Dialog.Popup className="fixed inset-y-0 right-0 z-50 flex w-[min(32rem,100vw)] flex-col border-l border-border bg-surface-raised shadow-float transition-[opacity,translate] duration-180 data-ending-style:translate-x-4 data-ending-style:opacity-0 data-starting-style:translate-x-4 data-starting-style:opacity-0 motion-reduce:transition-none">
          <header className="folio-rule flex items-start gap-4 p-5">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="font-display text-2xl leading-tight font-medium">
                {detail?.label ?? 'Event details'}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {detail ? (
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <SeverityLabel severity={detail.severity} />
                    <Outcome status={detail.status} />
                  </span>
                ) : (
                  'Audit event'
                )}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close details"
              className={cn(
                'grid size-10 shrink-0 place-items-center rounded-md hover:bg-hover',
                focusRing
              )}
            >
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-5" aria-busy={!detail && !loadError}>
            {loadError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-error/40 bg-error/10 px-3 py-2.5 text-sm text-error"
              >
                <CircleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
                <p className="flex-1">Couldn’t load this event.</p>
                <button
                  type="button"
                  onClick={() => {
                    setLoadError(false)
                    setAttempt((n) => n + 1)
                  }}
                  className={cn('rounded-sm font-medium underline', focusRing)}
                >
                  Retry
                </button>
              </div>
            )}

            {!detail && !loadError && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2
                  size={16}
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
                Loading…
              </p>
            )}

            {detail && (
              <>
                <dl className="divide-y divide-border">
                  <DetailRow label="Time">
                    <Stamp value={detail.createdAt} />
                  </DetailRow>
                  <DetailRow label="Event ID">
                    <span className="font-mono text-xs tabular-nums">{detail.id}</span>
                  </DetailRow>
                  <DetailRow label="Actor">
                    {detail.actor ? (
                      <span className="inline-flex items-center justify-end gap-2">
                        <ActorAvatar actor={detail.actor} size={24} />
                        <span className="min-w-0 text-left">
                          <span className="block truncate font-medium">
                            {detail.actor.displayName}
                          </span>
                          <span className="block truncate text-muted-foreground">
                            {detail.actor.email}
                            {detail.actor.roleName ? ` · ${detail.actor.roleName}` : ''}
                          </span>
                        </span>
                      </span>
                    ) : (
                      'System'
                    )}
                  </DetailRow>
                  <DetailRow label="Action">
                    <span className="font-mono text-xs">{detail.action}</span>
                  </DetailRow>
                  <DetailRow label="Target">
                    <Target type={detail.resourceType} id={detail.resourceId} />
                  </DetailRow>
                  <DetailRow label="IP address">
                    {detail.ip ? (
                      <span className="font-mono text-xs tabular-nums">{detail.ip}</span>
                    ) : (
                      '—'
                    )}
                  </DetailRow>
                  <DetailRow label="Location">{detail.location ?? '—'}</DetailRow>
                </dl>

                <section className="mt-6" aria-labelledby="audit-metadata">
                  <h3 id="audit-metadata" className="text-sm font-semibold">
                    Metadata
                  </h3>
                  {metadata.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No additional details were recorded.
                    </p>
                  ) : (
                    <dl className="mt-1 divide-y divide-border">
                      {metadata.map(([key, value]) => (
                        <DetailRow key={key} label={key}>
                          <span className="font-mono text-xs">{formatValue(value)}</span>
                        </DetailRow>
                      ))}
                    </dl>
                  )}
                </section>

                <section className="mt-6" aria-labelledby="audit-related">
                  <h3 id="audit-related" className="text-sm font-semibold">
                    Same actor, previous hour
                  </h3>
                  {detail.related.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">No other activity.</p>
                  ) : (
                    <ul className="mt-1 divide-y divide-border">
                      {detail.related.map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{r.label}</p>
                            <p className="text-sm text-muted-foreground">
                              <Stamp value={r.createdAt} />
                            </p>
                          </div>
                          <Outcome status={r.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default function AuditLogs({ events, meta, filters }: Props) {
  const { can } = usePermissions()
  const [search, setSearch] = useState(filters.actor)
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Extra pages loaded via "Load more". They belong to one result set, so any
  // new server payload (filter change) discards them.
  const [seenEvents, setSeenEvents] = useState(events)
  const [extra, setExtra] = useState<AuditEvent[]>([])
  const [cursor, setCursor] = useState(meta.nextCursor)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState(false)
  if (seenEvents !== events) {
    setSeenEvents(events)
    setExtra([])
    setCursor(meta.nextCursor)
    setMoreError(false)
  }

  const rows = useMemo(() => (extra.length > 0 ? [...events, ...extra] : events), [events, extra])

  function visit(next: Partial<Filters>) {
    const qs = new URLSearchParams(toQuery({ ...filters, ...next })).toString()
    router.get(qs ? `/audit-logs?${qs}` : '/audit-logs', undefined, {
      preserveState: true,
      preserveScroll: true,
      replace: true,
      onStart: () => setLoading(true),
      onFinish: () => setLoading(false),
    })
  }

  // Debounced actor search: write to the URL once typing pauses.
  useEffect(() => {
    const trimmed = search.trim()
    if (trimmed === filters.actor) return
    const id = window.setTimeout(() => visit({ actor: trimmed }), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const hasFilters =
    filters.actor !== '' ||
    filters.type !== 'all' ||
    filters.status !== 'all' ||
    filters.severity !== 'all' ||
    filters.from !== '' ||
    filters.to !== ''

  function clearFilters() {
    setSearch('')
    visit({ actor: '', type: 'all', status: 'all', severity: 'all', from: '', to: '' })
  }

  const exportQuery = new URLSearchParams(toQuery(filters)).toString()
  const exportHref = `/audit-logs/export${exportQuery ? `?${exportQuery}` : ''}`

  async function loadMore() {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    setMoreError(false)
    try {
      const params = new URLSearchParams({ ...toQuery(filters), cursor })
      const res = await fetch(`/audit-logs?${params}`, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error(String(res.status))
      const body = (await res.json()) as { events: AuditEvent[]; meta: Meta }
      setExtra((prev) => [...prev, ...body.events])
      setCursor(body.meta.nextCursor)
    } catch {
      setMoreError(true)
    } finally {
      setLoadingMore(false)
    }
  }

  const columns = useMemo<ColumnDef<AuditEvent>[]>(
    () => [
      {
        id: 'time',
        header: 'Time',
        meta: { cellClassName: 'whitespace-nowrap' },
        cell: ({ row: { original: e } }) => (
          <time
            dateTime={e.createdAt ?? undefined}
            className="text-[0.8125rem] text-muted-foreground tabular-nums"
          >
            {e.createdAt ? stampFmt.format(new Date(e.createdAt)) : '—'}
          </time>
        ),
      },
      {
        id: 'severity',
        header: 'Severity',
        meta: { className: 'hidden xl:table-cell' },
        cell: ({ row }) => <SeverityLabel severity={row.original.severity} />,
      },
      {
        id: 'actor',
        header: 'Actor',
        cell: ({ row: { original: e } }) => (
          <div className="flex items-center gap-3">
            <ActorAvatar actor={e.actor} />
            <div className="min-w-0">
              <p className="truncate font-medium">{e.actor?.displayName ?? 'System'}</p>
              {e.actor && (
                <p className="hidden truncate text-muted-foreground md:block">{e.actor.email}</p>
              )}
            </div>
          </div>
        ),
      },
      {
        id: 'action',
        header: 'Action',
        cell: ({ row: { original: e } }) => (
          <button
            type="button"
            onClick={(ev) => {
              ev.stopPropagation()
              setSelectedId(e.id)
            }}
            className={cn(
              'block max-w-full truncate rounded-sm text-left font-medium hover:underline',
              focusRing
            )}
          >
            {e.label}
          </button>
        ),
      },
      {
        id: 'target',
        header: 'Target',
        meta: { className: 'hidden lg:table-cell', cellClassName: 'max-w-56' },
        cell: ({ row: { original: e } }) => <Target type={e.resourceType} id={e.resourceId} />,
      },
      {
        id: 'outcome',
        header: 'Outcome',
        cell: ({ row }) => <Outcome status={row.original.status} />,
      },
      {
        id: 'eventId',
        header: 'Event ID',
        meta: { className: 'hidden xl:table-cell' },
        cell: ({ row: { original: e } }) => (
          <span
            title={e.id}
            className="block max-w-28 truncate font-mono text-xs text-muted-foreground tabular-nums"
          >
            {e.id}
          </span>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (e) => e.id,
    getCoreRowModel: getCoreRowModel(),
  })

  // Infinite scroll: fetch the next page as the virtualized window nears the
  // last loaded row. After a failure it stops, so a broken endpoint isn't
  // hammered; the button retries.
  function loadMoreNearEnd() {
    if (!moreError) void loadMore()
  }

  return (
    <>
      <Head title="Audit log" />
      <PageHeader
        title="Audit log"
        description="A record of sign-ins, access changes and other sensitive events."
        actions={
          can('audit.export') && (
            <a href={exportHref} download className={buttonVariants.secondary}>
              <Download size={18} aria-hidden="true" />
              Export CSV
            </a>
          )
        }
      />

      <form
        role="search"
        aria-label="Filter audit events"
        onSubmit={(e) => e.preventDefault()}
        className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-6"
      >
        <Field.Root className="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <Field.Label className="block text-sm font-medium">Actor</Field.Label>
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
              placeholder="Name, email or “system”"
              value={search}
              onValueChange={setSearch}
              className={cn(fieldClass, 'pr-11 pl-10 [&::-webkit-search-cancel-button]:hidden')}
            />
            {search && (
              <button
                type="button"
                aria-label="Clear actor search"
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
          label="Event type"
          value={filters.type}
          onValueChange={(type) => visit({ type })}
          options={TYPE_OPTIONS}
        />

        <SelectField
          label="Outcome"
          value={filters.status}
          onValueChange={(status) => visit({ status })}
          options={STATUS_OPTIONS}
        />

        <SelectField
          label="Severity"
          value={filters.severity}
          onValueChange={(severity) => visit({ severity })}
          options={SEVERITY_OPTIONS}
        />

        <Field.Root className="space-y-1.5 lg:col-span-2">
          <Field.Label className="block text-sm font-medium">From</Field.Label>
          <Input
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onValueChange={(from) => visit({ from })}
            className={fieldClass}
          />
        </Field.Root>

        <Field.Root className="space-y-1.5 lg:col-span-2">
          <Field.Label className="block text-sm font-medium">To</Field.Label>
          <Input
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onValueChange={(to) => visit({ to })}
            className={fieldClass}
          />
        </Field.Root>

        <div className="flex items-end sm:col-span-2 lg:col-span-2">
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
            ? 'No events match these filters.'
            : 'No events yet.'
          : `Showing ${nf.format(rows.length)} of ${nf.format(meta.total)} ${meta.total === 1 ? 'event' : 'events'}`}
      </p>

      <section
        className="relative overflow-hidden rounded-xl border border-border bg-surface"
        aria-label="Audit events"
      >
        {loading && (
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 z-10 h-0.5 animate-pulse bg-primary motion-reduce:animate-none"
          />
        )}

        {rows.length === 0 ? (
          <EmptyState
            icon={hasFilters ? Search : ScrollText}
            title={hasFilters ? 'No events match these filters' : 'No events yet'}
            description={
              hasFilters
                ? 'Try a wider date range or remove a filter.'
                : 'Sign-ins, access changes and other sensitive actions will be recorded here.'
            }
          >
            {hasFilters && (
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </EmptyState>
        ) : (
          <DataTable
            table={table}
            caption="Audit events, newest first"
            ariaRowCount={meta.total + 1}
            onRowClick={(row) => setSelectedId(row.original.id)}
            rowClassName={(row) =>
              row.original.severity === 'critical' || row.original.status !== 'success'
                ? exceptionRow
                : undefined
            }
            virtualize
            onNearEnd={cursor ? loadMoreNearEnd : undefined}
          />
        )}
      </section>

      {rows.length > 0 && (
        <nav aria-label="Pagination" className="mt-4 flex flex-col items-center gap-2">
          {moreError && (
            <p role="alert" className="text-sm text-error">
              Couldn’t load more events. Try again.
            </p>
          )}
          {cursor ? (
            <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
              {loadingMore && (
                <Loader2
                  size={18}
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              )}
              {loadingMore ? 'Loading…' : 'Load more events'}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">End of results.</p>
          )}
        </nav>
      )}

      <Inspector eventId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  )
}

AuditLogs.layout = withAppShell
