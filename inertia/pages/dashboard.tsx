import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Head, router } from '@inertiajs/react'
import { Link } from '@adonisjs/inertia/react'
import {
  AppWindow,
  CheckCircle2,
  CircleAlert,
  Clock,
  MonitorSmartphone,
  ShieldAlert,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { PageHeader } from '~/components/page-header'
import { withAppShell } from '~/layouts/app-shell'
import { usePermissions } from '~/hooks/use-permissions'
import { cn } from '~/lib/utils'

type Stats = {
  totalUsers: number
  usersDeltaWeek: number
  activeSessions: number
  authEvents24h: number
  failedLogins24h: number
  violations24h: number
}
type ActivityDay = { key: string; label: string; signins: number; failed: number }
type FeedItem = {
  id: string
  action: string
  label: string
  status: string
  actorName: string
  actorInitials: string
  createdAt: string | null
}
type AppAccess = { slug: string; name: string; count: number; countNote?: string }
type AppSummary = { slug: string; name: string; operational: boolean }

type Props = {
  stats: Stats
  activity: ActivityDay[]
  feed: FeedItem[]
  sessionsByApp: AppAccess[]
  apps: AppSummary[]
  lastUpdated: string
}

const POLL_MS = 30_000
const REFRESH_KEYS = ['stats', 'activity', 'feed', 'sessionsByApp', 'apps', 'lastUpdated']

const nf = new Intl.NumberFormat('en-US')
const timeFmt = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})
const stampFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

function Panel({
  title,
  description,
  className,
  action,
  children,
}: {
  title: string
  description?: string
  className?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      className={cn('rounded-xl border border-border bg-surface p-5 shadow-card md:p-6', className)}
    >
      <div className="-mx-5 mb-5 flex items-start justify-between gap-3 border-b border-border px-5 pb-4 md:-mx-6 md:px-6">
        <div className="min-w-0">
          <h2 className="text-[1.0625rem] leading-tight font-semibold">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Kpi({
  label,
  value,
  note,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: number
  note: string
  icon: LucideIcon
  tone?: 'default' | 'warning'
}) {
  return (
    <div
      className={cn(
        'relative px-5 py-5 md:px-6',
        'max-sm:not-first:border-t max-sm:border-border',
        'sm:max-xl:nth-[n+3]:border-t sm:max-xl:border-border sm:max-xl:even:perforated',
        'xl:not-first:perforated',
        tone === 'warning' && 'bg-alert-wash'
      )}
    >
      {tone === 'warning' && (
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-alert-fill" />
      )}
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon
          size={16}
          aria-hidden="true"
          className={tone === 'warning' ? 'text-warning' : 'text-muted-foreground'}
        />
        <span>{label}</span>
      </div>
      <p className="figure figure-in mt-3 text-[2.5rem] leading-none">{nf.format(value)}</p>
      <p className="mt-3 border-t border-border pt-2.5 text-[0.8125rem] text-muted-foreground">
        {note}
      </p>
    </div>
  )
}

/** Two-series line chart drawn in SVG; a visually hidden table carries the exact values. */
function ActivityChart({ data }: { data: ActivityDay[] }) {
  const W = 640
  const H = 240
  const pad = { t: 12, r: 24, b: 32, l: 40 }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b

  const peak = Math.max(1, ...data.flatMap((d) => [d.signins, d.failed]))
  const step = peak <= 4 ? 1 : Math.ceil(peak / 4 / 5) * 5
  const top = Math.ceil(peak / step) * step
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step)

  const x = (i: number) => pad.l + (data.length < 2 ? innerW / 2 : (i / (data.length - 1)) * innerW)
  const y = (v: number) => pad.t + innerH - (v / top) * innerH
  const line = (key: 'signins' | 'failed') =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(' ')

  const total = data.reduce((n, d) => n + d.signins + d.failed, 0)
  if (total === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        No activity has been recorded yet.
      </p>
    )
  }

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-0.5 w-5 bg-primary" />
          Successful events
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-0 w-5 border-t-2 border-dashed border-error" />
          Failed or denied
        </li>
      </ul>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Authentication events per day, ${data[0].label} to ${data[data.length - 1].label}. Exact values are in the table below.`}
        className="h-auto w-full"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={y(t)}
              y2={y(t)}
              className="stroke-border"
              strokeWidth="1"
              strokeDasharray={t === 0 ? undefined : '2 4'}
            />
            <text
              x={pad.l - 8}
              y={y(t) + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[11px] tabular-nums"
            >
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          i % 2 === 0 || i === data.length - 1 ? (
            <text
              key={d.key}
              x={x(i)}
              y={H - 10}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {d.label}
            </text>
          ) : null
        )}
        <path
          d={`${line('signins')} L${x(data.length - 1).toFixed(1)} ${y(0).toFixed(1)} L${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`}
          className="fill-primary-wash"
          stroke="none"
        />
        <path
          d={line('signins')}
          pathLength={1}
          fill="none"
          className="chart-draw stroke-primary"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d={line('failed')}
          fill="none"
          className="stroke-error"
          strokeWidth="2"
          strokeDasharray="5 4"
          strokeLinejoin="round"
        />
        {data.map((d, i) => (
          <g key={d.key}>
            {d.signins > 0 && (
              <circle cx={x(i)} cy={y(d.signins)} r="3.5" className="fill-primary" />
            )}
            {d.failed > 0 && (
              <rect x={x(i) - 3} y={y(d.failed) - 3} width="6" height="6" className="fill-error" />
            )}
          </g>
        ))}
        {data.map((d, i) =>
          d.signins === peak && peak > 0 ? (
            <text
              key={`peak-${d.key}`}
              x={x(i) - 8}
              y={y(d.signins) - 6}
              textAnchor="end"
              className="fill-foreground text-[12px] font-semibold tabular-nums"
            >
              {d.signins}
            </text>
          ) : null
        )}
      </svg>
      <p className="mt-1 text-xs text-muted-foreground">
        Events per day, last 14 days. Y axis: number of events.
      </p>
      <div className="sr-only">
        <table>
          <caption>Authentication events per day</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Successful</th>
              <th scope="col">Failed or denied</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.key}>
                <th scope="row">{d.label}</th>
                <td>{d.signins}</td>
                <td>{d.failed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AppAccessList({ items, apps }: { items: AppAccess[]; apps: AppSummary[] }) {
  const max = Math.max(1, ...items.map((i) => i.count))
  const state = new Map(apps.map((a) => [a.slug, a.operational]))

  if (items.every((i) => i.count === 0) && apps.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">No applications are registered yet.</p>
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => {
        const operational = state.get(item.slug)
        return (
          <li key={item.slug} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{item.name}</span>
              <span className="tabular-nums">
                {nf.format(item.count)}
                <span className="ml-1 text-muted-foreground">
                  {item.countNote ?? 'users with access'}
                </span>
              </span>
            </div>
            <div className="mt-2.5 grid grid-cols-10 gap-0.5" aria-hidden="true">
              {Array.from({ length: 10 }, (_, n) => (
                <span
                  key={n}
                  className={cn(
                    'h-2 rounded-xs',
                    n < Math.round((item.count / max) * 10) ? 'bg-primary' : 'bg-border'
                  )}
                />
              ))}
            </div>
            {operational !== undefined && (
              <p className={cn('stamp-chip mt-2.5', operational ? 'text-success' : 'text-warning')}>
                {operational ? (
                  <CheckCircle2 size={14} aria-hidden="true" />
                ) : (
                  <TriangleAlert size={14} aria-hidden="true" />
                )}
                {operational ? 'Enabled' : 'Disabled'}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function Outcome({ status }: { status: string }) {
  const ok = status === 'success'
  const Icon = ok ? CheckCircle2 : CircleAlert
  return (
    <span className={cn('stamp-chip', ok ? 'text-success' : 'text-error')}>
      <Icon size={16} aria-hidden="true" />
      {ok
        ? 'Success'
        : status === 'failure'
          ? 'Failure'
          : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function AuditFeed({ items }: { items: FeedItem[] }) {
  if (items.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">No activity has been recorded yet.</p>
  }
  return (
    <ul className="divide-y divide-border">
      {items.map((e) => (
        <li
          key={e.id}
          className="-mx-3 grid min-h-12 grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 rounded-md px-3 py-2.5 transition-colors duration-140 hover:bg-hover motion-reduce:transition-none sm:grid-cols-[9rem_1fr_auto]"
        >
          <time
            dateTime={e.createdAt ?? undefined}
            className="tabular text-xs text-muted-foreground sm:text-[0.8125rem]"
          >
            {e.createdAt ? stampFmt.format(new Date(e.createdAt)) : '—'}
          </time>
          <div className="min-w-0 sm:order-none">
            <p className="truncate text-sm font-medium">{e.label}</p>
            <p className="truncate text-sm text-muted-foreground">by {e.actorName}</p>
          </div>
          <div className="col-span-2 sm:col-span-1 sm:justify-self-end">
            <Outcome status={e.status} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function Dashboard({
  stats,
  activity,
  feed,
  sessionsByApp,
  apps,
  lastUpdated,
}: Props) {
  const { can } = usePermissions()
  // A failed poll records the payload timestamp it failed on; a newer successful payload clears it.
  const [failedOn, setFailedOn] = useState<string | null>(null)
  const stale = failedOn === lastUpdated
  const latest = useRef(lastUpdated)
  useEffect(() => {
    latest.current = lastUpdated
  }, [lastUpdated])

  // Poll only while the tab is visible. On failure keep the last good data and flag it as stale.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      router.reload({
        only: REFRESH_KEYS,
        onError: () => setFailedOn(latest.current),
      })
    }, POLL_MS)
    const onFailure = () => setFailedOn(latest.current)
    document.addEventListener('inertia:exception', onFailure)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('inertia:exception', onFailure)
    }
  }, [])

  const updated = timeFmt.format(new Date(lastUpdated))
  const attention = stats.failedLogins24h + stats.violations24h

  return (
    <>
      <Head title="Dashboard" />
      <PageHeader
        title="Dashboard"
        description="Identity activity across Share, Portfolio and Desk."
        actions={
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Clock size={16} aria-hidden="true" />
            <span className="tabular-nums">Last updated {updated}</span>
            {stale && (
              <span className="inline-flex items-center gap-1 font-medium text-warning">
                <TriangleAlert size={14} aria-hidden="true" />
                Stale — refresh failed
              </span>
            )}
          </p>
        }
      />

      <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-border bg-surface shadow-card sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Active users"
          value={stats.totalUsers}
          note={`${nf.format(stats.usersDeltaWeek)} added in the last 7 days`}
          icon={Users}
        />
        <Kpi
          label="Active sessions"
          value={stats.activeSessions}
          note="Unexpired sessions right now"
          icon={MonitorSmartphone}
        />
        <Kpi
          label="Registered apps"
          value={apps.length}
          note={`${apps.filter((a) => a.operational).length} enabled`}
          icon={AppWindow}
        />
        <Kpi
          label="Auth events, 24 hours"
          value={stats.authEvents24h}
          note={`${nf.format(stats.failedLogins24h)} failed or denied`}
          icon={ShieldAlert}
          tone={stats.failedLogins24h > 0 ? 'warning' : 'default'}
        />
      </div>

      {attention > 0 && (
        <p
          className="mt-4 flex items-start gap-2.5 rounded-lg border border-l-[3px] border-border border-l-alert-fill bg-alert-wash px-4 py-3 text-sm"
          role="note"
        >
          <TriangleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-warning" />
          <span className="font-medium">
            {nf.format(stats.failedLogins24h)} failed sign-in
            {stats.failedLogins24h === 1 ? '' : 's'} and {nf.format(stats.violations24h)} policy
            violation{stats.violations24h === 1 ? '' : 's'} in the last 24 hours.
            {can('audit.read') && (
              <>
                {' '}
                <Link
                  route="audit.index"
                  className={cn('rounded-sm font-medium text-primary hover:underline', focusRing)}
                >
                  Review in audit log
                </Link>
              </>
            )}
          </span>
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel title="Authentication activity" description="Last 14 days" className="lg:col-span-7">
          <ActivityChart data={activity} />
        </Panel>
        <Panel
          title="Access by application"
          description="Users entitled to each app, plus live Console sessions"
          className="lg:col-span-5"
        >
          <AppAccessList items={sessionsByApp} apps={apps} />
        </Panel>
      </div>

      <Panel
        title="Recent audit events"
        description="Latest 10 events"
        className="mt-4"
        action={
          can('audit.read') ? (
            <Link
              route="audit.index"
              className={cn(
                'shrink-0 rounded-sm text-sm font-medium text-primary hover:underline',
                focusRing
              )}
            >
              View all
            </Link>
          ) : undefined
        }
      >
        <AuditFeed items={feed} />
      </Panel>
    </>
  )
}

Dashboard.layout = withAppShell
