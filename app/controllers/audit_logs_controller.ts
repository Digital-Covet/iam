import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import AuditLog from '#models/audit_log'
import { AUDIT_SEVERITIES, redactSecrets } from '#services/audit_severity'
import type { HttpContext } from '@adonisjs/core/http'

const auditFilterValidator = vine.create({
  actor: vine.string().maxLength(254).optional(),
  type: vine
    .enum(['all', 'sessions', 'signins', 'failed', 'tokens', 'roles', 'violations'])
    .optional(),
  status: vine.enum(['all', 'success', 'failure']).optional(),
  severity: vine.enum(['all', ...AUDIT_SEVERITIES]).optional(),
  from: vine.string().optional(),
  to: vine.string().optional(),
  cursor: vine.string().optional(),
  limit: vine.number().positive().max(200).optional(),
})

const EXPORT_LIMIT = 10_000

function humanizeAction(action: string): string {
  return action
    .split(/[._-]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

function initialsOf(name: string | null, email: string | null): string {
  const source = (name?.trim() || email?.split('@')[0] || '?').trim()
  const parts = source.split(/[\s._-]+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

function locationOf(geo: Record<string, any> | null): string | null {
  if (!geo) return null
  const city = (geo.city ?? geo.locality ?? '') as string
  const region = (geo.region ?? geo.region_code ?? '') as string
  const country = (geo.country ?? geo.country_code ?? '') as string
  const parts = [city, country || region].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}

function parseCursor(cursor?: string): { createdAt: string; id: string } | null {
  if (!cursor) return null
  const [createdAt, id] = cursor.split('__')
  if (!createdAt || !id) return null
  const dt = DateTime.fromISO(createdAt)
  if (!dt.isValid) return null
  return { createdAt: dt.toSQL()!, id }
}

function encodeCursor(createdAt: string | null, id: string): string | null {
  if (!createdAt) return null
  return `${createdAt}__${id}`
}

function applyFilters(
  query: any,
  opts: {
    search: string
    type: string
    status: string
    severity: string
    from?: string
    to?: string
  }
) {
  const { search, type, status, severity, from, to } = opts

  if (search) {
    const term = `%${search}%`
    const wantsSystem = 'system'.includes(search.toLowerCase())
    query.where((q: any) => {
      q.whereHas('actor', (a: any) => {
        a.whereILike('name', term).orWhereILike('email', term)
      })
      if (wantsSystem) q.orWhereNull('actor_id')
    })
  }

  if (type !== 'all') {
    query.where((q: any) => {
      if (type === 'sessions') {
        q.whereILike('action', '%session%')
      } else if (type === 'signins') {
        q.whereILike('action', '%login%')
          .orWhereILike('action', '%sign_in%')
          .orWhereILike('action', '%signin%')
          .orWhereILike('action', '%auth%')
      } else if (type === 'failed') {
        q.where('status', 'failure').where((qq: any) => {
          qq.whereILike('action', '%login%')
            .orWhereILike('action', '%sign%')
            .orWhereILike('action', '%fail%')
            .orWhereILike('action', '%denied%')
        })
      } else if (type === 'tokens') {
        q.whereILike('action', '%token%')
          .orWhereILike('action', '%renew%')
          .orWhereILike('action', '%refresh%')
          .orWhereILike('action', '%oauth%')
      } else if (type === 'roles') {
        q.whereILike('action', '%role%')
          .orWhereILike('action', '%entitlement%')
          .orWhereILike('action', '%grant%')
          .orWhereILike('action', '%permission%')
      } else if (type === 'violations') {
        q.whereILike('action', '%violation%')
          .orWhereILike('action', '%policy%')
          .orWhereILike('action', '%suspend%')
      }
    })
  }

  if (status !== 'all') {
    query.where('status', status)
  }

  if (severity !== 'all') {
    query.where('severity', severity)
  }

  if (from) {
    const dt = DateTime.fromISO(from)
    if (dt.isValid) query.where('created_at', '>=', dt.startOf('day').toSQL())
  }
  if (to) {
    const dt = DateTime.fromISO(to)
    if (dt.isValid) query.where('created_at', '<=', dt.endOf('day').toSQL())
  }
}

function serializeLog(log: AuditLog) {
  const actor = (log as any).actor as
    { id: string; name: string | null; email: string; image: string | null } | null | undefined
  const created = log.createdAt?.toISO?.() ?? null
  return {
    id: log.id,
    action: log.action,
    label: humanizeAction(log.action),
    status: log.status,
    severity: log.severity,
    createdAt: created,
    actor: actor
      ? {
          id: actor.id,
          name: actor.name,
          email: actor.email,
          initials: initialsOf(actor.name ?? null, actor.email ?? null),
          image: actor.image ?? null,
          displayName: actor.name ?? actor.email.split('@')[0],
        }
      : null,
    ip: log.ipAddress,
    location: locationOf(log.geo),
    resourceType: log.resourceType,
    resourceId: log.resourceId,
  }
}

export default class AuditLogsController {
  async index({ request, inertia, response }: HttpContext) {
    const f = await request.validateUsing(auditFilterValidator, { data: request.qs() })
    const search = f.actor?.trim() || ''
    const type = f.type ?? 'all'
    const status = f.status ?? 'all'
    const severity = f.severity ?? 'all'
    const limit = f.limit ?? 100
    const cursor = parseCursor(f.cursor)

    const filters = { actor: search, type, status, severity, from: f.from ?? '', to: f.to ?? '' }

    // Total for aria-rowcount + "N events" — same filters, no cursor.
    const countQuery = AuditLog.query()
    applyFilters(countQuery, { search, type, status, severity, from: f.from, to: f.to })
    const totalRow = await countQuery.count('* as total').first()
    const total = Number((totalRow?.$extras as any)?.total ?? 0)

    const query = AuditLog.query()
      .preload('actor')
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(limit + 1)
    applyFilters(query, { search, type, status, severity, from: f.from, to: f.to })
    if (cursor) {
      query.where((q: any) => {
        q.where('created_at', '<', cursor.createdAt).orWhere((qq: any) => {
          qq.where('created_at', cursor.createdAt).where('id', '<', cursor.id)
        })
      })
    }

    const rows = await query
    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    const last = page[page.length - 1]
    const nextCursor =
      hasMore && last ? encodeCursor(last.createdAt?.toISO?.() ?? null, last.id) : null

    const events = page.map(serializeLog)
    const meta = { total, nextCursor, hasMore, limit }

    // Plain fetch (infinite-scroll sentinel) → JSON. Inertia visits carry X-Inertia.
    if (!request.header('x-inertia')) {
      return response.ok({ events, meta, filters })
    }

    return inertia.render('audit_logs', { events, meta, filters })
  }

  /** JSON detail for the InspectorSheet — event + actor + related. */
  async show({ params, response }: HttpContext) {
    const log = await AuditLog.query()
      .where('id', params.id)
      .preload('actor', (a) => a.preload('role'))
      .firstOrFail()

    const actor = (log as any).actor as any
    let related: any[] = []
    if (log.actorId) {
      const hourAgo = DateTime.now().minus({ hours: 1 }).toSQL()
      related = await AuditLog.query()
        .where('actor_id', log.actorId)
        .whereNot('id', log.id)
        .where('created_at', '>=', hourAgo!)
        .orderBy('created_at', 'desc')
        .limit(5)
    }

    // Secrets are redacted here, not only in the UI: this JSON is readable by any
    // `audit.read` holder and by anything that can call the endpoint.
    const metadata = redactSecrets(log.metadata ?? {}) as Record<string, any>
    return response.ok({
      id: log.id,
      action: log.action,
      label: humanizeAction(log.action),
      status: log.status,
      severity: log.severity,
      createdAt: log.createdAt?.toISO?.() ?? null,
      ip: log.ipAddress,
      location: locationOf(log.geo),
      metadata: {
        client: metadata.client ?? metadata.client_id ?? null,
        method: metadata.method ?? null,
        userAgent: metadata.user_agent ?? metadata.userAgent ?? null,
        sessionId: metadata.session_id ?? metadata.sessionId ?? null,
        ...metadata,
      },
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      actor: actor
        ? {
            id: actor.id,
            name: actor.name,
            email: actor.email,
            initials: initialsOf(actor.name ?? null, actor.email ?? null),
            image: actor.image ?? null,
            displayName: actor.name ?? actor.email.split('@')[0],
            roleName: actor.role?.name?.toLowerCase?.() ?? null,
          }
        : null,
      related: related.map((r) => ({
        id: r.id,
        action: r.action,
        label: humanizeAction(r.action),
        status: r.status,
        createdAt: r.createdAt?.toISO?.() ?? null,
      })),
    })
  }

  /** CSV of the current filters (newest first, capped). Every export is itself audited. */
  async export({ request, response, auth }: HttpContext) {
    const f = await request.validateUsing(auditFilterValidator, { data: request.qs() })
    const opts = {
      search: f.actor?.trim() || '',
      type: f.type ?? 'all',
      status: f.status ?? 'all',
      severity: f.severity ?? 'all',
      from: f.from,
      to: f.to,
    }

    const query = AuditLog.query()
      .preload('actor')
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(EXPORT_LIMIT)
    applyFilters(query, opts)
    const rows = await query

    // Cells starting with = + - @ are executed as formulas by spreadsheets.
    const esc = (v: unknown) => {
      let s = String(v ?? '')
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
      return `"${s.replace(/"/g, '""')}"`
    }
    const lines = [
      'time,severity,outcome,actor,actor_email,action,target_type,target_id,ip,event_id',
    ]
    for (const log of rows) {
      const actor = (log as any).actor as { name: string | null; email: string } | null
      lines.push(
        [
          log.createdAt?.toISO?.() ?? '',
          log.severity,
          log.status,
          actor?.name ?? (actor ? '' : 'System'),
          actor?.email ?? '',
          log.action,
          log.resourceType ?? '',
          log.resourceId ?? '',
          log.ipAddress ?? '',
          log.id,
        ]
          .map(esc)
          .join(',')
      )
    }

    await AuditLog.create({
      actorId: auth.user?.id ?? null,
      action: 'audit.export',
      resourceType: 'audit_log',
      status: 'success',
      ipAddress: request.ip(),
      metadata: { rows: rows.length, filters: opts },
    })

    response.header('Content-Type', 'text/csv; charset=utf-8')
    response.header('Content-Disposition', 'attachment; filename="audit-log.csv"')
    return response.send(lines.join('\n'))
  }
}
