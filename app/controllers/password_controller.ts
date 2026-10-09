import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import User from '#models/user'
import Account from '#models/account'
import AuditLog from '#models/audit_log'
import CredentialService, { CREDENTIAL_PROVIDER } from '#services/credential_service'
import MailService, { setPasswordLink } from '#services/mail_service'
import TokenService from '#services/token_service'
import PasswordPolicy from '#models/password_policy'
import PasswordService from '#services/password_service'
import { policyError } from '#services/password_policy_service'
import type { HttpContext } from '@adonisjs/core/http'

const forgotValidator = vine.create({
  email: vine.string().email().maxLength(254),
})

const resetValidator = vine.create({
  password: vine.string().minLength(8).maxLength(128),
  passwordConfirmation: vine.string().sameAs('password'),
})

/** Forgot-password, and the set-password page used by both resets and invites. */
export default class PasswordController {
  async showForgot({ inertia }: HttpContext) {
    return inertia.render('auth/forgot_password', {})
  }

  /** Always answers the same way so the form can't be used to find accounts. */
  async sendReset({ request, response, session }: HttpContext) {
    const { email } = await request.validateUsing(forgotValidator)
    const user = await User.query()
      .where('email', email)
      .whereNull('deleted_at')
      .whereNull('banned_at')
      .first()

    if (user) {
      try {
        const token = await TokenService.issue(user.id, 'reset')
        await MailService.sendReset(user.email, setPasswordLink(token))
      } catch (error) {
        console.error('Password reset email failed', error)
      }
    }

    session.flash('success', 'If that email has an account, a reset link is on its way.')
    return response.redirect().back()
  }

  async showReset({ params, inertia, response, session }: HttpContext) {
    const found = await TokenService.find(params.token)
    if (!found) {
      session.flash('error', 'That link has expired or was already used. Request a new one.')
      return response.redirect('/forgot-password')
    }
    const policy = await PasswordPolicy.query().first()
    return inertia.render('auth/reset_password', {
      token: params.token,
      kind: found.kind,
      // The validator enforces a floor of 8 regardless of the stored policy.
      policy: {
        minLength: Math.max(policy?.minLength ?? 8, 8),
        requireUppercase: policy?.requireUppercase ?? false,
        requireLowercase: policy?.requireLowercase ?? false,
        requireNumber: policy?.requireNumber ?? false,
        requireSpecial: policy?.requireSpecial ?? false,
      },
    })
  }

  async storeReset({ params, request, response, session }: HttpContext) {
    const found = await TokenService.find(params.token)
    if (!found) {
      session.flash('error', 'That link has expired or was already used. Request a new one.')
      return response.redirect('/forgot-password')
    }

    const { password } = await request.validateUsing(resetValidator)
    const policy = await PasswordPolicy.query().first()
    const problem = policyError(password, policy)
    if (problem) {
      session.flash('error', problem)
      return response.redirect().back()
    }

    const user = await User.query()
      .where('id', found.row.userId!)
      .whereNull('deleted_at')
      .whereNull('banned_at')
      .first()
    if (!user) {
      await TokenService.consume(found.row)
      session.flash('error', 'This account is not available. Ask an admin.')
      return response.redirect('/login')
    }

    const account = await Account.query()
      .where('user_id', user.id)
      .where('provider_id', CREDENTIAL_PROVIDER)
      .first()
    if (account) {
      const reused = await PasswordService.reuseError(account, password, policy)
      if (reused) {
        session.flash('error', reused)
        return response.redirect().back()
      }
      await PasswordService.setPassword(account, password)
    } else {
      await CredentialService.createAccount(user, password)
    }

    if (!user.emailVerified) {
      user.emailVerified = true
      user.emailVerifiedAt = DateTime.now()
      await user.save()
    }
    await TokenService.consume(found.row)

    await AuditLog.create({
      actorId: user.id,
      action: found.kind === 'invite' ? 'invitation.accepted' : 'password.reset',
      resourceType: 'user',
      resourceId: user.id,
      status: 'success',
      ipAddress: request.ip(),
      metadata: {},
    })

    session.flash('success', 'Your password is set. Sign in to continue.')
    return response.redirect('/login')
  }
}
