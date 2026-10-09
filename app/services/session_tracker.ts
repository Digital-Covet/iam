import { createHash } from 'node:crypto'
import { DateTime } from 'luxon'
import AuditLog from '#models/audit_log'
import Session from '#models/session'
import type { HttpContext } from '@adonisjs/core/http'
import type User from '#models/user'

/**
 * Marks a browser session as having a `session` row. A tracked session whose
 * row has vanished was revoked; an untracked one predates this service and is
 * adopted instead of being signed out.
 */
const TRACKED_KEY = 'iam_session_tracked'

/** Keep in step with `age` in config/session.ts. */
const SESSION_TTL_HOURS = 2
const TOUCH_AFTER_SECONDS = 60

export type LoginMethod = 'password' | 'password+totp' | 'password+backup_code' | 'signup'

/**
 * Mirrors every signed-in browser session into the `session` table so the
 * dashboard, account settings and directory have something to read, and so
 * "revoke session" really signs that browser out. The row token is a hash of
 * the framework session id, never the id itself.
 */
export default class SessionTracker {
  static tokenOf(ctx: HttpContext): string {
    return createHash('sha256').update(ctx.session.sessionId).digest('hex')
  }

  /**
   * Country/city from the edge headers set by Cloudflare or Vercel. There is
   * no IP-lookup dependency, so geo is null when running without an edge.
   */
  static geoOf(ctx: HttpContext): Record<string, string> | null {
    const header = (name: string) => ctx.request.header(name) || undefined
    const city = header('cf-ipcity') ?? header('x-vercel-ip-city')
    const region = header('cf-region') ?? header('x-vercel-ip-country-region')
    const country = header('cf-ipcountry') ?? header('x-vercel-ip-country')

    const geo: Record<string, string> = {}
    if (city) geo.city = safeDecode(city)
    if (region) geo.region = safeDecode(region)
    if (country && country !== 'XX') geo.country = country
    return Object.keys(geo).length > 0 ? geo : null
  }

  /** Append an audit row carrying the request's IP, geo and user agent. */
  static async audit(
    ctx: HttpContext,
    entry: {
      action: string
      actorId: string | null
      status: 'success' | 'failure'
      resourceType?: string
      resourceId?: string | null
      metadata?: Record<string, unknown>
    }
  ) {
    await AuditLog.create({
      actorId: entry.actorId,
      action: entry.action,
      resourceType: entry.resourceType ?? 'user',
      resourceId: entry.resourceId ?? entry.actorId,
      status: entry.status,
      ipAddress: ctx.request.ip(),
      geo: this.geoOf(ctx),
      metadata: {
        userAgent: ctx.request.header('user-agent') ?? null,
        ...entry.metadata,
      },
    })
  }

  /** Call right after `auth.login()`: creates the row and audits the sign-in. */
  static async recordLogin(ctx: HttpContext, user: User, method: LoginMethod) {
    await this.#upsert(ctx, user.id)
    await this.audit(ctx, {
      action: 'auth.login',
      actorId: user.id,
      status: 'success',
      metadata: { method },
    })
  }

  /** Call before `auth.logout()` while the session id is still available. */
  static async recordLogout(ctx: HttpContext, userId: string, metadata?: Record<string, unknown>) {
    await Session.query().where('token', this.tokenOf(ctx)).delete()
    await this.audit(ctx, { action: 'auth.logout', actorId: userId, status: 'success', metadata })
  }

  /**
   * Per-request check for signed-in users. Returns 'revoked' when the session
   * row was deleted (revoked elsewhere) or has expired.
   */
  static async validate(ctx: HttpContext, user: User): Promise<'ok' | 'revoked'> {
    const userId = user.id

    // Suspended or deleted accounts lose every session, even untracked ones.
    if (user.bannedAt || user.deletedAt) {
      await this.revokeAll(userId)
      return 'revoked'
    }

    const row = await Session.findBy('token', this.tokenOf(ctx))

    if (!row) {
      if (ctx.session.get(TRACKED_KEY)) return 'revoked'
      await this.#upsert(ctx, userId)
      return 'ok'
    }

    if (row.userId !== userId || row.expiresAt <= DateTime.now()) {
      await row.delete()
      return 'revoked'
    }

    if (row.updatedAt < DateTime.now().minus({ seconds: TOUCH_AFTER_SECONDS })) {
      row.expiresAt = DateTime.now().plus({ hours: SESSION_TTL_HOURS })
      row.ipAddress = ctx.request.ip()
      row.userAgent = ctx.request.header('user-agent') ?? row.userAgent
      await row.save()
    }
    return 'ok'
  }

  /**
   * Delete a user's session rows so those browsers are signed out on their
   * next request. Pass `exceptToken` to keep the caller's own session.
   * Returns how many were revoked.
   */
  static async revokeAll(userId: string, exceptToken?: string): Promise<number> {
    const rows = await Session.query()
      .where('user_id', userId)
      .if(exceptToken, (q) => q.whereNot('token', exceptToken!))
    await Promise.all(rows.map((row) => row.delete()))
    return rows.length
  }

  static async #upsert(ctx: HttpContext, userId: string) {
    const now = DateTime.now()
    // Opportunistic cleanup keeps the table from growing without bound.
    await Session.query().where('user_id', userId).where('expires_at', '<', now.toSQL()).delete()

    await Session.updateOrCreate(
      { token: this.tokenOf(ctx) },
      {
        userId,
        expiresAt: now.plus({ hours: SESSION_TTL_HOURS }),
        ipAddress: ctx.request.ip(),
        userAgent: ctx.request.header('user-agent') ?? null,
        geo: this.geoOf(ctx),
      }
    )
    ctx.session.put(TRACKED_KEY, true)
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
