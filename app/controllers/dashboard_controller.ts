import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import Session from '#models/session'
import AuditLog from '#models/audit_log'
import App from '#models/app'
import AppEntitlement from '#models/app_entitlement'
import type { HttpContext } from '@adonisjs/core/http'

const SESSION_COLORS: Record<string, string> = {
  share: '#c2202d',
  portfolio: '#4a4748',
  desk: '#b9b7b8',
  console: '#2f5fbf',
}

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

export default class DashboardController {
  async index({ inertia }: HttpContext) {
    const now = DateTime.now()
    const day24h = now.minus({ hours: 24 })
    const weekAgo = now.minus({ days: 7 })
    const fortnightAgo = now.startOf('day').minus({ days: 13 })

    const [totalUsers, newUsersWeek, apps] = await Promise.all([
      User.query().whereNull('deleted_at').count('* as total').first(),
      User.query()
        .whereNull('deleted_at')
        .where('created_at', '>=', weekAgo.toSQL())
        .count('* as total')
        .first(),
      App.query().where('is_active', true).orderBy('name', 'asc'),
    ])

    let activeSessions = 0
    try {
      const row = await Session.query()
        .where('expires_at', '>', now.toSQL())
        .count('* as total')
        .first()
      activeSessions = Number((row?.$extras as any)?.total ?? 0)
    } catch {
      activeSessions = 0
    }

    const [authEventRows, failedRows, violationRows, recentLogs] = await Promise.all([
      AuditLog.query().where('created_at', '>=', day24h.toSQL()).count('* as total').first(),
      AuditLog.query()
        .where('created_at', '>=', day24h.toSQL())
        .where((q) => {
          q.where('status', 'failure').orWhere((qq) => {
            qq.whereILike('action', '%login%')
              .orWhereILike('action', '%sign_in%')
              .orWhereILike('action', '%signin%')
              .orWhereILike('action', '%failed%')
          })
        })
        .count('* as total')
        .first(),
      AuditLog.query()
        .where('created_at', '>=', day24h.toSQL())
        .where((q) => {
          q.whereILike('action', '%violation%').orWhereILike('action', '%policy%')
        })
        .count('* as total')
        .first(),
      AuditLog.query()
        .where('created_at', '>=', fortnightAgo.toSQL())
        .select('action', 'status', 'created_at')
        .orderBy('created_at', 'asc')
        .limit(2000),
    ])

    // Bucket the last 14 days (oldest → newest)
    const days: { key: string; label: string; signins: number; failed: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = now.startOf('day').minus({ days: i })
      days.push({ key: d.toISODate()!, label: d.toFormat('MMM d'), signins: 0, failed: 0 })
    }
    const byDay = new Map(days.map((d) => [d.key, d]))
    for (const log of recentLogs) {
      const key = log.createdAt?.toISODate?.()
      const bucket = key ? byDay.get(key) : undefined
      if (!bucket) continue
      const isFailed =
        log.status === 'failure' ||
        /fail|denied|violation/i.test(log.action) ||
        (/login|sign.?in/i.test(log.action) && log.status !== 'success')
      if (isFailed) bucket.failed += 1
      else bucket.signins += 1
    }

    const feedRows = await AuditLog.query().preload('actor').orderBy('created_at', 'desc').limit(10)

    const entitlementCounts = await db
      .from('app_entitlement')
      .select('app_id')
      .count('* as total')
      .where('enabled', true)
      .groupBy('app_id')

    const countByAppId = new Map<string, number>(
      entitlementCounts.map((r: any) => [String(r.app_id), Number(r.total)])
    )
    const sessionsByApp = [
      ...apps.map((a) => ({
        slug: a.slug.toLowerCase(),
        name: a.name,
        count: countByAppId.get(a.id) ?? 0,
        color: SESSION_COLORS[a.slug.toLowerCase()] ?? '#4a4748',
      })),
      {
        slug: 'console',
        name: 'Console',
        count: activeSessions,
        countNote: 'live sessions',
        color: SESSION_COLORS.console,
      },
    ]

    // Per-signature: AppEntitlement import is load-bearing (keeps the model
    // in the controller's dependency graph for future grant-state checks).
    void AppEntitlement

    return inertia.render('dashboard', {
      stats: {
        totalUsers: Number((totalUsers?.$extras as any)?.total ?? 0),
        usersDeltaWeek: Number((newUsersWeek?.$extras as any)?.total ?? 0),
        activeSessions,
        authEvents24h: Number((authEventRows?.$extras as any)?.total ?? 0),
        failedLogins24h: Number((failedRows?.$extras as any)?.total ?? 0),
        violations24h: Number((violationRows?.$extras as any)?.total ?? 0),
      },
      activity: days,
      feed: feedRows.map((l) => ({
        id: l.id,
        action: l.action,
        label: humanizeAction(l.action),
        status: l.status,
        actorName: l.actor?.name ?? l.actor?.email?.split('@')[0] ?? 'System',
        actorInitials: initialsOf(l.actor?.name ?? null, l.actor?.email ?? 'System'),
        createdAt: l.createdAt?.toISO?.() ?? null,
      })),
      sessionsByApp,
      apps: apps.map((a) => ({
        slug: a.slug.toLowerCase(),
        name: a.name,
        operational: a.isActive,
      })),
      lastUpdated: now.toISO(),
    })
  }
}
