import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import Role from '#models/role'
import App from '#models/app'
import AppEntitlement from '#models/app_entitlement'
import AuditLog from '#models/audit_log'
import Session from '#models/session'
import { accessFor } from '#services/access_service'
import OAuthService from '#services/oauth_service'
import MailService, { setPasswordLink } from '#services/mail_service'
import SessionTracker from '#services/session_tracker'
import TokenService from '#services/token_service'
import type { HttpContext } from '@adonisjs/core/http'

const APP_SLUGS = ['share', 'portfolio', 'desk'] as const
type AppSlug = (typeof APP_SLUGS)[number]

const directoryFilterValidator = vine.create({
  search: vine.string().maxLength(254).optional(),
  // Free-form: custom roles (created in Roles & access) filter like system ones.
  role: vine.string().maxLength(50).optional(),
  status: vine.enum(['all', 'active', 'invited', 'suspended']).optional(),
  app: vine.enum(['all', 'share', 'portfolio', 'desk']).optional(),
  sort: vine.enum(['name', 'email', 'createdAt', 'updatedAt', 'lastActive']).optional(),
  direction: vine.enum(['asc', 'desc']).optional(),
  page: vine.number().positive().optional(),
})

const inviteValidator = vine.create({
  email: vine.string().email().maxLength(254),
  // Any existing role name — system or custom.
  role: vine.string().trim().minLength(2).maxLength(50),
  apps: vine.array(vine.enum(['share', 'portfolio', 'desk'])).optional(),
})

type Auth = HttpContext['auth']

async function viewerRoleName(auth: Auth): Promise<string> {
  const viewer = auth.getUserOrFail()
  await viewer.load('role')
  return viewer.role?.name?.toLowerCase() ?? 'employee'
}

async function canManageSuperadmin(auth: Auth) {
  return (await viewerRoleName(auth)) === 'superadmin'
}

/** Only superadmins may hand out the superadmin role. */
async function canAssignRole(auth: Auth, role: Role) {
  return role.name.toLowerCase() !== 'superadmin' || (await canManageSuperadmin(auth))
}

async function isLastSuperadmin(user: User) {
  const row = await db
    .from('user')
    .join('role', 'role.id', 'user.role_id')
    .whereNull('user.deleted_at')
    .whereRaw('lower(role.name) = ?', ['superadmin'])
    .whereNot('user.id', user.id)
    .count('* as total')
    .first()
  return Number(row?.total ?? 0) === 0
}

async function deliverInvite(user: User, inviterName: string | null) {
  const token = await TokenService.issue(user.id, 'invite')
  await MailService.sendInvite(user.email, setPasswordLink(token), inviterName)
}

function toStatus(user: User): 'active' | 'invited' | 'suspended' {
  if (user.bannedAt) return 'suspended'
  if (!user.emailVerified) return 'invited'
  return 'active'
}

function serializeListUser(user: User, appMap: Map<string, AppSlug>) {
  const grants: Record<AppSlug, boolean> = { share: false, portfolio: false, desk: false }
  const entitlements = (user as any).appEntitlements as AppEntitlement[] | undefined
  if (entitlements) {
    for (const e of entitlements) {
      const slug = appMap.get(e.appId)
      if (slug && e.enabled) grants[slug] = true
    }
  }
  // Last active = most recent session update, else user update
  const sessions = (user as any).sessions as { updatedAt?: any }[] | undefined
  let lastActive: string | null = null
  if (sessions && sessions.length > 0) {
    lastActive = sessions[0].updatedAt?.toISO?.() ?? String(sessions[0].updatedAt)
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    initials: user.initials,
    image: user.image,
    role: user.role
      ? { id: user.role.id, name: user.role.name, description: user.role.description }
      : null,
    roleName: user.role?.name?.toLowerCase() ?? 'employee',
    status: toStatus(user),
    emailVerified: user.emailVerified,
    bannedAt: user.bannedAt?.toISO?.() ?? null,
    banReason: user.banReason,
    twoFactorEnabled: Boolean((user as any).twoFactor?.enabled),
    apps: grants,
    lastActive: lastActive ?? user.updatedAt?.toISO?.() ?? null,
    joined: user.createdAt?.toISO?.() ?? null,
  }
}

export default class DirectoryController {
  async index({ request, inertia }: HttpContext) {
    const filters = await request.validateUsing(directoryFilterValidator, {
      data: request.qs(),
    })
    const search = filters.search?.trim() || ''
    const roleFilter = filters.role ?? 'all'
    const statusFilter = filters.status ?? 'all'
    const appFilter = filters.app ?? 'all'
    const sort = filters.sort ?? 'name'
    const direction = filters.direction ?? 'asc'
    const page = filters.page ?? 1

    const apps = await App.query().where('is_active', true).orderBy('name', 'asc')
    const roles = await Role.query().orderBy('name', 'asc')
    const appIdMap = new Map(apps.map((a) => [a.id, a.slug.toLowerCase() as AppSlug]))

    const sortColumn =
      sort === 'email'
        ? 'email'
        : sort === 'createdAt'
          ? 'created_at'
          : sort === 'updatedAt'
            ? 'updated_at'
            : 'name'

    const query = User.query()
      .whereNull('deleted_at')
      .preload('role')
      .preload('appEntitlements')
      .preload('twoFactor')
      .preload('sessions', (s) => s.orderBy('updated_at', 'desc').limit(1))

    if (search) {
      const term = `%${search}%`
      query.where((q) => {
        q.whereILike('name', term).orWhereILike('email', term)
      })
    }

    if (roleFilter !== 'all') {
      query.whereHas('role', (r) => r.whereILike('name', roleFilter))
    }

    if (statusFilter === 'suspended') {
      query.whereNotNull('banned_at')
    } else if (statusFilter === 'invited') {
      query.whereNull('banned_at').where('email_verified', false)
    } else if (statusFilter === 'active') {
      query.whereNull('banned_at').where('email_verified', true)
    }

    if (appFilter !== 'all') {
      const target = apps.find((a) => a.slug.toLowerCase() === appFilter)
      if (target) {
        query.whereHas('appEntitlements', (e) => {
          e.where('app_id', target.id).where('enabled', true)
        })
      } else {
        // Unknown app slug — force empty result, never full table
        query.where('id', '__none__')
      }
    }

    if (sort === 'lastActive') {
      // Same definition as the column shown: newest session, else the account's own update time.
      query.orderByRaw(
        `coalesce((select max(s.updated_at) from session s where s.user_id = "user".id), "user".updated_at) ${direction === 'desc' ? 'desc' : 'asc'}`
      )
    } else {
      query.orderBy(sortColumn, direction as 'asc' | 'desc')
    }

    const paginator = await query.paginate(page, 25)
    const serialized = paginator.all().map((u) => serializeListUser(u, appIdMap))

    return inertia.render('directory', {
      users: serialized,
      meta: {
        total: paginator.getMeta().total,
        perPage: paginator.getMeta().perPage,
        currentPage: paginator.getMeta().currentPage,
        lastPage: paginator.getMeta().lastPage,
      },
      filters: { search, role: roleFilter, status: statusFilter, app: appFilter, sort, direction },
      roles: roles.map((r) => ({ id: r.id, name: r.name, description: r.description })),
      apps: apps.map((a) => ({ id: a.id, slug: a.slug.toLowerCase(), name: a.name })),
    })
  }

  /** JSON detail for the UserSheet — sessions + audit tail + entitlements. */
  async show(ctx: HttpContext) {
    const { params, response } = ctx
    const access = await accessFor(ctx)
    const user = await User.query()
      .whereNull('deleted_at')
      .where('id', params.id)
      .preload('role')
      .preload('appEntitlements', (e) => e.preload('app' as any))
      .preload('sessions', (s) =>
        s.where('expires_at', '>', DateTime.now().toSQL()).orderBy('updated_at', 'desc').limit(10)
      )
      .firstOrFail()

    const apps = await App.query().where('is_active', true).orderBy('name', 'asc')

    // Sessions, entitlements and the audit tail each need their own permission.
    const audit = access.can('audit.read')
      ? await AuditLog.query().where('actor_id', user.id).orderBy('created_at', 'desc').limit(10)
      : []

    return response.ok({
      id: user.id,
      name: user.name,
      email: user.email,
      initials: user.initials,
      image: user.image,
      role: user.role ? { id: user.role.id, name: user.role.name } : null,
      roleName: user.role?.name?.toLowerCase() ?? 'employee',
      status: toStatus(user),
      emailVerified: user.emailVerified,
      bannedAt: user.bannedAt?.toISO?.() ?? null,
      banReason: user.banReason,
      joined: user.createdAt?.toISO?.() ?? null,
      lastActive: user.updatedAt?.toISO?.() ?? null,
      entitlements: apps.map((a) => {
        const grant = (user.appEntitlements as AppEntitlement[]).find((e) => e.appId === a.id)
        return {
          appId: a.id,
          slug: a.slug.toLowerCase(),
          name: a.name,
          enabled: access.can('entitlements.read') ? (grant?.enabled ?? false) : false,
          claim: `app_access claim: ${a.slug.toLowerCase()}`,
        }
      }),
      sessions: (access.can('sessions.read') ? user.sessions : []).map((s) => ({
        id: s.id,
        ip: s.ipAddress,
        agent: s.userAgent,
        geo: s.geo,
        lastActive: s.updatedAt?.toISO?.() ?? null,
        created: s.createdAt?.toISO?.() ?? null,
      })),
      audit: audit.map((a) => ({
        id: a.id,
        action: a.action,
        status: a.status,
        created: a.createdAt?.toISO?.() ?? null,
        metadata: a.metadata,
      })),
    })
  }

  async invite({ request, response, session, auth }: HttpContext) {
    const { email, role, apps: appSlugs } = await request.validateUsing(inviteValidator)
    const roleRow = await Role.query().whereILike('name', role.trim()).first()
    if (!roleRow) {
      session.flash('error', `Unknown role: ${role}.`)
      return response.redirect().back()
    }
    if (!(await canAssignRole(auth, roleRow))) {
      session.flash('error', 'Only superadmins can grant the superadmin role.')
      return response.redirect().back()
    }

    const existing = await User.query().whereNull('deleted_at').where('email', email).first()
    if (existing) {
      session.flash('error', 'That email already has an account.')
      return response.redirect().back()
    }

    const grants = appSlugs ?? []

    const invited = await db.transaction(async (trx) => {
      const user = await User.create(
        { email, name: null, roleId: roleRow.id, emailVerified: false },
        { client: trx }
      )
      for (const slug of grants) {
        const app = await App.findBy('slug', slug, { client: trx })
        if (!app) continue
        await AppEntitlement.create(
          { userId: user.id, appId: app.id, enabled: true, grantedBy: auth.user?.id ?? null },
          { client: trx }
        )
      }
      await AuditLog.create(
        {
          actorId: auth.user?.id ?? null,
          action: 'invitation.sent',
          resourceType: 'user',
          resourceId: user.id,
          status: 'success',
          ipAddress: request.ip(),
          metadata: { email, role: roleRow.name },
        },
        { client: trx }
      )
      return user
    })

    try {
      await deliverInvite(invited, auth.user?.name ?? null)
    } catch (error) {
      console.error('Invite email failed', error)
      session.flash(
        'error',
        `${email} was added, but the email could not be sent. Use Resend on their profile.`
      )
      return response.redirect().back()
    }

    session.flash('success', `Invitation sent to ${email}.`)
    return response.redirect().back()
  }

  /** POST /directory/:id/resend-invite — new link for someone still Invited. */
  async resendInvite({ params, response, session, auth }: HttpContext) {
    const user = await User.query().whereNull('deleted_at').where('id', params.id).firstOrFail()
    if (user.emailVerified) {
      session.flash('error', 'That person has already accepted their invitation.')
      return response.redirect().back()
    }
    try {
      await deliverInvite(user, auth.user?.name ?? null)
    } catch (error) {
      console.error('Invite email failed', error)
      session.flash('error', 'The email could not be sent. Try again in a moment.')
      return response.redirect().back()
    }
    session.flash('success', `Invitation re-sent to ${user.email}.`)
    return response.redirect().back()
  }

  async updateRole({ params, request, response, session, auth }: HttpContext) {
    const { role } = await request.validateUsing(
      vine.create({ role: vine.string().trim().minLength(2).maxLength(50) })
    )
    const user = await User.query().whereNull('deleted_at').where('id', params.id).firstOrFail()
    const roleRow = await Role.query().whereILike('name', role.trim()).first()
    if (!roleRow) {
      session.flash('error', `Unknown role: ${role}.`)
      return response.redirect().back()
    }
    if (!(await canAssignRole(auth, roleRow))) {
      session.flash('error', 'Only superadmins can grant the superadmin role.')
      return response.redirect().back()
    }
    if (auth.user?.id === user.id) {
      session.flash('error', 'You cannot change your own role.')
      return response.redirect().back()
    }
    await user.load('role')
    if (user.role?.name?.toLowerCase() === 'superadmin') {
      if (!(await canManageSuperadmin(auth))) {
        session.flash('error', 'Only superadmins can change a superadmin’s role.')
        return response.redirect().back()
      }
      if (roleRow.name.toLowerCase() !== 'superadmin' && (await isLastSuperadmin(user))) {
        session.flash('error', 'You cannot demote the last superadmin.')
        return response.redirect().back()
      }
    }
    user.roleId = roleRow.id
    await user.save()
    await AuditLog.create({
      actorId: auth.user?.id ?? null,
      action: 'role.granted',
      resourceType: 'user',
      resourceId: user.id,
      status: 'success',
      ipAddress: request.ip(),
      metadata: { role: roleRow.name },
    })
    session.flash('success', `Role changed to ${roleRow.name}.`)
    return response.redirect().back()
  }

  async updateStatus({ params, request, response, session, auth }: HttpContext) {
    const { status, reason } = await request.validateUsing(
      vine.create({
        status: vine.enum(['suspend', 'reactivate']),
        reason: vine.string().trim().maxLength(500).optional(),
      })
    )
    const user = await User.query().whereNull('deleted_at').where('id', params.id).firstOrFail()
    await user.load('role')
    if (user.role?.name?.toLowerCase() === 'superadmin' && !(await canManageSuperadmin(auth))) {
      session.flash('error', 'Only superadmins can change a superadmin’s status.')
      return response.redirect().back()
    }
    if (status === 'suspend' && auth.user?.id === user.id) {
      session.flash('error', 'You cannot suspend your own account.')
      return response.redirect().back()
    }
    if (status === 'suspend') {
      user.bannedAt = DateTime.now()
      user.banReason = reason || null
      await user.save()
      const revoked = await SessionTracker.revokeAll(user.id)
      await OAuthService.revokeUserGrants(user.id, 'user_suspended')
      await AuditLog.create({
        actorId: auth.user?.id ?? null,
        action: 'user.suspended',
        resourceType: 'user',
        resourceId: user.id,
        status: 'success',
        ipAddress: request.ip(),
        metadata: { reason: reason || null, sessionsRevoked: revoked },
      })
      session.flash('success', `${user.email} suspended and signed out.`)
    } else {
      user.bannedAt = null
      user.banReason = null
      await user.save()
      await AuditLog.create({
        actorId: auth.user?.id ?? null,
        action: 'user.reactivated',
        resourceType: 'user',
        resourceId: user.id,
        status: 'success',
        ipAddress: request.ip(),
        metadata: {},
      })
      session.flash('success', `${user.email} reactivated.`)
    }
    return response.redirect().back()
  }

  /**
   * DELETE /directory/:id/sessions[/:sessionId] — sign a user out of one
   * device, or of every device. Revoking your own sessions keeps the one
   * you're using.
   */
  async revokeSessions(ctx: HttpContext) {
    const { params, request, response, session, auth } = ctx
    const user = await User.query().whereNull('deleted_at').where('id', params.id).firstOrFail()
    await user.load('role')
    if (user.role?.name?.toLowerCase() === 'superadmin' && !(await canManageSuperadmin(auth))) {
      session.flash('error', 'Only superadmins can sign a superadmin out.')
      return response.redirect().back()
    }

    const own = auth.user?.id === user.id
    const keepToken = own ? SessionTracker.tokenOf(ctx) : undefined

    let revoked = 0
    if (params.sessionId) {
      const row = await Session.query()
        .where('id', params.sessionId)
        .where('user_id', user.id)
        .first()
      if (row && row.token !== keepToken) {
        await row.delete()
        revoked = 1
      }
    } else {
      revoked = await SessionTracker.revokeAll(user.id, keepToken)
    }

    if (revoked === 0) {
      session.flash('error', 'There was nothing to sign out.')
      return response.redirect().back()
    }

    await AuditLog.create({
      actorId: auth.user?.id ?? null,
      action: 'session.revoked',
      resourceType: 'user',
      resourceId: user.id,
      status: 'success',
      ipAddress: request.ip(),
      metadata: { byAdmin: true, count: revoked, sessionId: params.sessionId ?? null },
    })
    session.flash(
      'success',
      revoked === 1 ? 'Signed out of 1 device.' : `Signed out of ${revoked} devices.`
    )
    return response.redirect().back()
  }

  /**
   * DELETE /directory/:id/two-factor — admin reset for a lost device +
   * lost backup codes. Gated by `users.mfa.reset`; only a superadmin may
   * reset a superadmin. Deletes the row, revokes every session, audits and
   * emails the owner.
   */
  async resetTwoFactor(ctx: HttpContext) {
    const { params, request, response, session, auth } = ctx
    const user = await User.query().whereNull('deleted_at').where('id', params.id).firstOrFail()
    await user.load('role')
    await user.load('twoFactor').catch(() => {})
    if (user.role?.name?.toLowerCase() === 'superadmin' && !(await canManageSuperadmin(auth))) {
      session.flash('error', 'Only superadmins can reset a superadmin’s two-factor.')
      return response.redirect().back()
    }
    if (!user.twoFactor) {
      session.flash('error', 'Two-factor is not enabled for this account.')
      return response.redirect().back()
    }
    await user.twoFactor.delete()
    const revoked = await SessionTracker.revokeAll(user.id)
    await OAuthService.revokeUserGrants(user.id, 'mfa_reset')
    await AuditLog.create({
      actorId: auth.user?.id ?? null,
      action: 'auth.2fa_reset',
      resourceType: 'user',
      resourceId: user.id,
      status: 'success',
      ipAddress: request.ip(),
      metadata: { byAdmin: true, sessionsRevoked: revoked },
    })
    try {
      await MailService.sendTwoFactorNotice(user.email, 'reset_by_admin')
    } catch (error) {
      console.error('2FA reset email failed', error)
    }
    session.flash('success', `${user.email} can sign in with a password and set up 2FA again.`)
    return response.redirect().back()
  }

  async toggleEntitlement(ctx: HttpContext) {
    const { params, request, response, session, auth } = ctx
    const { app: slug, enabled } = await request.validateUsing(
      vine.create({
        app: vine.enum(['share', 'portfolio', 'desk']),
        enabled: vine.boolean(),
      })
    )
    const access = await accessFor(ctx)
    if (!access.can(enabled ? 'entitlements.grant' : 'entitlements.revoke')) {
      session.flash(
        'error',
        `You do not have access to ${enabled ? 'grant' : 'revoke'} app access.`
      )
      return response.redirect().back()
    }
    const user = await User.query().whereNull('deleted_at').where('id', params.id).firstOrFail()
    const app = await App.findByOrFail('slug', slug)
    const existing = await AppEntitlement.query()
      .where('user_id', user.id)
      .where('app_id', app.id)
      .first()
    if (existing) {
      existing.enabled = enabled
      await existing.save()
    } else {
      await AppEntitlement.create({
        userId: user.id,
        appId: app.id,
        enabled,
        grantedBy: auth.user?.id ?? null,
      })
    }
    // Taking access away also ends the app's tokens, not just the next sign-in.
    if (!enabled) await OAuthService.revokeUserGrants(user.id, 'access_removed', { appId: app.id })
    await AuditLog.create({
      actorId: auth.user?.id ?? null,
      action: enabled ? 'entitlement.granted' : 'entitlement.revoked',
      resourceType: 'user',
      resourceId: user.id,
      status: 'success',
      ipAddress: request.ip(),
      metadata: { app: slug },
    })
    session.flash(
      'success',
      `${app.name} access ${enabled ? 'granted' : 'revoked'}. Takes effect on next sign-in.`
    )
    return response.redirect().back()
  }

  async destroy({ params, request, response, session, auth }: HttpContext) {
    const user = await User.query().whereNull('deleted_at').where('id', params.id).firstOrFail()
    if (auth.user && auth.user.id === user.id) {
      session.flash('error', 'You cannot delete your own account.')
      return response.redirect().back()
    }
    await user.load('role')
    if (user.role?.name?.toLowerCase() === 'superadmin') {
      if (!(await canManageSuperadmin(auth))) {
        session.flash('error', 'Only superadmins can delete a superadmin.')
        return response.redirect().back()
      }
      if (await isLastSuperadmin(user)) {
        session.flash('error', 'You cannot delete the last superadmin.')
        return response.redirect().back()
      }
    }
    user.deletedAt = DateTime.now()
    await user.save()
    await SessionTracker.revokeAll(user.id)
    await OAuthService.revokeUserGrants(user.id, 'user_deleted')
    await AuditLog.create({
      actorId: auth.user?.id ?? null,
      action: 'user.deleted',
      resourceType: 'user',
      resourceId: user.id,
      status: 'success',
      ipAddress: request.ip(),
      metadata: { email: user.email },
    })
    session.flash('success', `${user.email} deleted.`)
    return response.redirect().back()
  }

  async export({ request, response }: HttpContext) {
    const filters = await request.validateUsing(directoryFilterValidator, { data: request.qs() })
    const search = filters.search?.trim() || ''
    const query = User.query().whereNull('deleted_at').preload('role').preload('appEntitlements')
    if (search) {
      const term = `%${search}%`
      query.where((q) => {
        q.whereILike('name', term).orWhereILike('email', term)
      })
    }
    const roleFilter = filters.role ?? 'all'
    const statusFilter = filters.status ?? 'all'
    const appFilter = filters.app ?? 'all'
    if (roleFilter !== 'all') {
      query.whereHas('role', (r) => r.whereILike('name', roleFilter))
    }
    if (statusFilter === 'suspended') {
      query.whereNotNull('banned_at')
    } else if (statusFilter === 'invited') {
      query.whereNull('banned_at').where('email_verified', false)
    } else if (statusFilter === 'active') {
      query.whereNull('banned_at').where('email_verified', true)
    }
    const apps = await App.query()
    if (appFilter !== 'all') {
      const target = apps.find((a) => a.slug.toLowerCase() === appFilter)
      if (target) {
        query.whereHas('appEntitlements', (e) => {
          e.where('app_id', target.id).where('enabled', true)
        })
      } else {
        query.where('id', '__none__')
      }
    }
    const rows = await query.orderBy('name', 'asc').limit(2000)
    const appIdMap = new Map(apps.map((a) => [a.id, a.slug.toLowerCase()]))
    const lines = ['name,email,role,status,share,portfolio,desk']
    for (const u of rows) {
      const grants: Record<string, boolean> = { share: false, portfolio: false, desk: false }
      for (const e of u.appEntitlements) {
        const slug = appIdMap.get(e.appId)
        if (slug && slug in grants && e.enabled) grants[slug] = true
      }
      const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
      lines.push(
        [
          esc(u.name),
          esc(u.email),
          esc(u.role?.name ?? ''),
          esc(toStatus(u)),
          grants.share ? 'yes' : 'no',
          grants.portfolio ? 'yes' : 'no',
          grants.desk ? 'yes' : 'no',
        ].join(',')
      )
    }
    response.header('Content-Type', 'text/csv')
    response.header('Content-Disposition', 'attachment; filename="user-directory.csv"')
    return response.send(lines.join('\n'))
  }
}
