import { readFile } from 'node:fs/promises'
import { DateTime } from 'luxon'
import User from '#models/user'
import Session from '#models/session'
import App from '#models/app'
import AppEntitlement from '#models/app_entitlement'
import Account from '#models/account'
import AuditLog from '#models/audit_log'
import PasswordPolicy from '#models/password_policy'
import CredentialService from '#services/credential_service'
import { policyError } from '#services/password_policy_service'
import AvatarService from '#services/avatar_service'
import OAuthService from '#services/oauth_service'
import PasswordService from '#services/password_service'
import SessionTracker from '#services/session_tracker'
import {
  passwordValidator,
  profileValidator,
  revokeAppValidator,
} from '#validators/account_settings'
import type { HttpContext } from '@adonisjs/core/http'

function initialsOf(name: string | null, email: string): string {
  const source = name?.trim() || email.split('@')[0]
  const parts = source.split(/[\s._-]+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

export default class AccountSettingsController {
  /**
   * GET /account-settings — your own profile, password, sessions,
   * two-factor status and apps. All roles.
   */
  async index(ctx: HttpContext) {
    const { inertia, auth } = ctx
    const user = auth.user!
    await user.load('role').catch(() => {})
    await user.load('twoFactor').catch(() => {})

    const expiry = await PasswordService.expiryFor(user.id)
    const [sessions, apps, entitlements, policy] = await Promise.all([
      Session.query()
        .where('user_id', user.id)
        .where('expires_at', '>', DateTime.now().toSQL())
        .orderBy('updated_at', 'desc')
        .limit(20),
      App.query().whereNull('deleted_at').where('is_active', true).orderBy('name', 'asc'),
      AppEntitlement.query().where('user_id', user.id),
      PasswordPolicy.query().first(),
    ])

    const enabledByAppId = new Map(entitlements.map((e) => [e.appId, e.enabled]))
    const currentToken = SessionTracker.tokenOf(ctx)

    // Rotate the history encryption key after the sensitive 2FA pages.
    inertia.clearHistory()
    return inertia.render('account_settings', {
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        initials: user.initials ?? initialsOf(user.name, user.email),
        image: user.image,
        roleName: user.role?.name ?? 'Employee',
      },
      sessions: sessions.map((s) => ({
        id: s.id,
        ip: s.ipAddress,
        agent: s.userAgent,
        lastActive: s.updatedAt?.toISO?.() ?? null,
        created: s.createdAt?.toISO?.() ?? null,
        current: s.token === currentToken,
      })),
      apps: apps.map((a) => ({
        id: a.id,
        slug: a.slug.toLowerCase(),
        name: a.name,
        description: a.description,
        enabled: enabledByAppId.get(a.id) ?? false,
        claim: `app_access claim: ${a.slug.toLowerCase()}`,
      })),
      twoFactor: {
        enabled: user.twoFactor?.enabled ?? false,
        backupCodesRemaining: user.twoFactor?.backupCodesHashed?.length ?? 0,
      },
      passwordPolicy: {
        minLength: policy?.minLength ?? 8,
        requireUppercase: policy?.requireUppercase ?? false,
        requireLowercase: policy?.requireLowercase ?? false,
        requireNumber: policy?.requireNumber ?? false,
        requireSpecial: policy?.requireSpecial ?? false,
        historyCount: policy?.historyCount ?? 0,
        expiresAt: expiry.expiresAt?.toISO() ?? null,
        daysLeft: expiry.expiresAt ? Math.ceil(expiry.expiresAt.diffNow('days').days) : null,
      },
      storageConfigured: AvatarService.isConfigured(),
    })
  }

  /** PATCH /account-settings/profile — change name and/or photo. */
  async updateProfile({ request, response, session, auth }: HttpContext) {
    const user = auth.user!
    const { name } = await request.validateUsing(profileValidator)

    const avatar = request.file('avatar', {
      size: '2mb',
      extnames: ['jpg', 'jpeg', 'png', 'webp'],
    })

    if (avatar && !avatar.isValid) {
      session.flash('error', 'That photo did not work. Use a JPG, PNG or WebP under 2MB.')
      return response.redirect().back()
    }

    if (name !== undefined) {
      user.name = name?.trim() ? name.trim() : null
    }

    let previousPath: string | null = null
    if (avatar?.tmpPath) {
      try {
        const buffer = await readFile(avatar.tmpPath)
        const contentType =
          avatar.type && avatar.subtype ? `${avatar.type}/${avatar.subtype}` : 'image/jpeg'
        const uploaded = await AvatarService.upload(
          user.id,
          buffer,
          contentType,
          avatar.extname ?? 'jpg'
        )
        previousPath = user.avatarPath
        user.image = uploaded.url
        user.avatarPath = uploaded.path
      } catch (error) {
        session.flash(
          'error',
          error instanceof Error ? error.message : 'Photo upload failed. Try again.'
        )
        return response.redirect().back()
      }
    }

    await user.save()
    // Only after the new photo is saved, so a failed save never loses the old one.
    if (previousPath && previousPath !== user.avatarPath) await AvatarService.remove(previousPath)

    await AuditLog.create({
      actorId: user.id,
      action: 'profile.updated',
      resourceType: 'user',
      resourceId: user.id,
      status: 'success',
      ipAddress: request.ip(),
      metadata: { name: user.name },
    })

    session.flash('success', 'Your profile is updated.')
    return response.redirect().back()
  }

  /**
   * PATCH /account-settings/password — must type the current
   * password first, then the new one twice.
   */
  async updatePassword({ request, response, session, auth }: HttpContext) {
    const user = auth.user!
    const { currentPassword, newPassword } = await request.validateUsing(passwordValidator)

    try {
      await CredentialService.verify(user.email, currentPassword)
    } catch {
      session.flash('error', 'Your current password is wrong. Try again.')
      return response.redirect().back()
    }

    const policy = await PasswordPolicy.query().first()
    const problem = policyError(newPassword, policy)
    if (problem) {
      session.flash('error', problem)
      return response.redirect().back()
    }

    const account = await Account.query()
      .where('user_id', user.id)
      .where('provider_id', 'credential')
      .first()
    if (!account) {
      session.flash('error', 'No password login on this account. Ask an admin.')
      return response.redirect().back()
    }

    const reused = await PasswordService.reuseError(account, newPassword, policy)
    if (reused) {
      session.flash('error', reused)
      return response.redirect().back()
    }

    await PasswordService.setPassword(account, newPassword)

    await AuditLog.create({
      actorId: user.id,
      action: 'password.changed',
      resourceType: 'user',
      resourceId: user.id,
      status: 'success',
      ipAddress: request.ip(),
      metadata: {},
    })

    session.flash('success', 'Your password is changed. Use it next time you sign in.')
    return response.redirect().back()
  }

  /** DELETE /account-settings/sessions/:id — log out one device. */
  async revokeSession({ params, request, response, session, auth }: HttpContext) {
    const user = auth.user!
    const row = await Session.query().where('id', params.id).where('user_id', user.id).first()

    if (!row) {
      session.flash('error', 'That session is already gone.')
      return response.redirect().back()
    }

    await row.delete()
    await AuditLog.create({
      actorId: user.id,
      action: 'session.revoked',
      resourceType: 'session',
      resourceId: params.id,
      status: 'success',
      ipAddress: request.ip(),
      metadata: { self: true },
    })

    session.flash('success', 'That device is logged out.')
    return response.redirect().back()
  }

  /** PATCH /account-settings/apps/:slug — remove your own access to one app. */
  async revokeApp({ params, request, response, session, auth }: HttpContext) {
    const user = auth.user!
    const slug = String(params.slug ?? '').toLowerCase()
    const { enabled } = await request.validateUsing(revokeAppValidator)

    // Self-service only ever removes access — granting stays with admins.
    if (enabled) {
      session.flash('error', 'To get access, ask an admin.')
      return response.redirect().back()
    }

    const app = await App.query().whereNull('deleted_at').whereILike('slug', slug).first()
    if (!app) {
      session.flash('error', 'Unknown app.')
      return response.redirect().back()
    }

    const existing = await AppEntitlement.query()
      .where('user_id', user.id)
      .where('app_id', app.id)
      .first()

    if (existing) {
      existing.enabled = false
      await existing.save()
    } else {
      await AppEntitlement.create({
        userId: user.id,
        appId: app.id,
        enabled: false,
        grantedBy: user.id,
      })
    }

    // Keep a row for the removed user so the directory export stays honest.
    void User
    await OAuthService.revokeUserGrants(user.id, 'access_removed', { appId: app.id })

    await AuditLog.create({
      actorId: user.id,
      action: 'entitlement.revoked',
      resourceType: 'app',
      resourceId: app.id,
      status: 'success',
      ipAddress: request.ip(),
      metadata: { app: slug, self: true },
    })

    session.flash('success', `${app.name} access removed. It is signed out of your account now.`)
    return response.redirect().back()
  }
}
