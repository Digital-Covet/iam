import User from '#models/user'
import PasswordPolicy from '#models/password_policy'
import AuthMethod from '#models/auth_method'
import AuditLog from '#models/audit_log'
import { accessFor } from '#services/access_service'
import { methodValidator, policyValidator } from '#validators/auth_settings'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Auth settings — `/auth-settings` · Utility · SETTINGS nav.
 * Stacked sections with ledger-rule headers: password policy + auth-method
 * registry. Each section saves independently. The routes check the
 * `settings.*` permissions; by default only superadmin holds the update keys,
 * and only a superadmin can grant them to another role.
 */
export default class AuthSettingsController {
  async index(ctx: HttpContext) {
    const { inertia } = ctx
    const access = await accessFor(ctx)

    let policy = await PasswordPolicy.query().first()
    if (!policy) {
      policy = await PasswordPolicy.create({
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumber: true,
        requireSpecial: false,
        maxAgeDays: null,
        historyCount: 0,
        extraRules: {},
      })
    }
    await policy.load('updatedByUser').catch(() => {})

    const methods = await AuthMethod.query().orderBy('name', 'asc')
    const countRow = await User.query().whereNull('deleted_at').count('* as total').first()
    const userCount = Number((countRow?.$extras as any)?.total ?? 0)

    return inertia.render('auth_settings', {
      policy: {
        minLength: policy.minLength,
        requireUppercase: policy.requireUppercase,
        requireLowercase: policy.requireLowercase,
        requireNumber: policy.requireNumber,
        requireSpecial: policy.requireSpecial,
        maxAgeDays: policy.maxAgeDays,
        historyCount: policy.historyCount,
        requireTwoFactor: policy.extraRules?.requireTwoFactor === true,
        updatedAt: policy.updatedAt?.toISO?.() ?? null,
        updatedBy: (policy as any).updatedByUser?.name ?? null,
      },
      methods: methods.map((m) => ({
        key: m.key,
        name: m.name,
        enabled: m.enabled,
        locked: m.key === 'credential',
      })),
      userCount,
      // Each save route enforces its own key; the page saves both sections.
      canSave: access.canAny(['settings.password_policy.update', 'settings.auth_methods.update']),
    })
  }

  /** PATCH /auth-settings/policy — needs settings.password_policy.update. */
  async updatePolicy({ request, response, session, auth }: HttpContext) {
    const payload = await request.validateUsing(policyValidator)
    const { requireTwoFactor, ...policyFields } = payload

    let policy = await PasswordPolicy.query().first()
    if (!policy) {
      policy = new PasswordPolicy()
    }
    policy.merge({ ...policyFields, updatedBy: auth.user?.id ?? null })
    policy.extraRules = {
      ...(policy.extraRules ?? {}),
      ...(requireTwoFactor !== undefined ? { requireTwoFactor } : {}),
    }
    await policy.save()

    await AuditLog.create({
      actorId: auth.user?.id ?? null,
      action: 'policy.updated',
      resourceType: 'password_policy',
      resourceId: policy.id,
      status: 'success',
      ipAddress: request.ip(),
      metadata: { ...payload },
    })

    session.flash(
      'success',
      'Password policy saved. Rules apply on the next password change; expiry counts from each person’s last change.'
    )
    return response.redirect().back()
  }

  /** PATCH /auth-settings/methods/:key — needs settings.auth_methods.update. */
  async updateMethod({ params, request, response, session, auth }: HttpContext) {
    const { enabled } = await request.validateUsing(methodValidator)
    const key = String(params.key ?? '').toLowerCase()
    const method = await AuthMethod.query().whereILike('key', key).first()

    if (!method) {
      session.flash('error', 'Unknown auth method.')
      return response.redirect().back()
    }

    // Email & password is the one guaranteed path (login keeps exactly one
    // path per the one-instruction rule) — it can never be switched off.
    if (method.key === 'credential' && !enabled) {
      session.flash('error', 'Email & password cannot be disabled — it is the fallback sign-in.')
      return response.redirect().back()
    }

    if (!enabled) {
      const others = await AuthMethod.query().whereNot('id', method.id).where('enabled', true)
      if (others.length === 0) {
        session.flash('error', 'Keep at least one sign-in method enabled.')
        return response.redirect().back()
      }
    }

    if (method.enabled === enabled) {
      return response.redirect().back()
    }

    method.enabled = enabled
    await method.save()

    await AuditLog.create({
      actorId: auth.user?.id ?? null,
      action: enabled ? 'auth_method.enabled' : 'auth_method.disabled',
      resourceType: 'auth_method',
      resourceId: method.id,
      status: 'success',
      ipAddress: request.ip(),
      metadata: { key: method.key },
    })

    session.flash(
      'success',
      `${method.name} ${enabled ? 'enabled' : 'disabled'}. Takes effect on the next sign-in.`
    )
    return response.redirect().back()
  }
}
