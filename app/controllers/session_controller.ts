import CredentialService from '#services/credential_service'
import { redirectToPasswordReset } from '#services/expired_password'
import { postLoginPath } from '#services/intended_url'
import PasswordService from '#services/password_service'
import SessionTracker from '#services/session_tracker'
import { PASSWORD_ONLY, rememberSignIn } from '#services/sign_in_context'
import { startChallenge } from '#services/two_factor_challenge'
import { loginValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class SessionController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/login', {})
  }

  async store(ctx: HttpContext) {
    const { request, auth, response, session } = ctx
    const { email, password } = await request.validateUsing(loginValidator)

    try {
      const user = await CredentialService.verify(email, password)
      await user.load('twoFactor')
      const expiry = await PasswordService.expiryFor(user.id)

      // 2FA hand-off (§6.4): password valid but a second factor is required —
      // do NOT log in yet. This runs before the expiry check so that a
      // password alone can never be traded for a reset link on a 2FA account.
      if (user.twoFactor?.enabled) {
        startChallenge(session, user.id, expiry.expired ? 'password_reset' : 'login')
        return response.redirect().toRoute('two_factor.showVerify')
      }

      // Expired password: hand out a one-time link to choose a new password
      // instead of signing in.
      if (expiry.expired) {
        return redirectToPasswordReset(ctx, user.id)
      }

      await auth.use('web').login(user)
      await SessionTracker.recordLogin(ctx, user, 'password')
      rememberSignIn(session, PASSWORD_ONLY)
    } catch (error) {
      // Wrong email/password must surface as the card-level alert (§6.4),
      // not a 400 error page — flash it and send the user back to the form.
      if ((error as { code?: string })?.code === 'E_INVALID_CREDENTIALS') {
        await SessionTracker.audit(ctx, {
          action: 'auth.login_failed',
          actorId: null,
          status: 'failure',
          resourceId: null,
          metadata: { email },
        })
        session.flash('error', "That email and password don't match.")
        return response.redirect().back()
      }
      if ((error as { code?: string })?.code === 'E_ACCOUNT_SUSPENDED') {
        const { userId, reason } = error as { userId: string; reason: string | null }
        await SessionTracker.audit(ctx, {
          action: 'auth.login_blocked',
          actorId: userId,
          status: 'failure',
          metadata: { reason: 'suspended' },
        })
        session.flash(
          'error',
          reason
            ? `This account is suspended: ${reason}. Contact an administrator.`
            : 'This account is suspended. Contact an administrator.'
        )
        return response.redirect().back()
      }
      throw error
    }

    return response.redirect().withQs(false).toPath(postLoginPath(session))
  }

  async destroy(ctx: HttpContext) {
    const { auth, response } = ctx
    if (auth.user) await SessionTracker.recordLogout(ctx, auth.user.id)
    await auth.use('web').logout()
    return response.redirect().toRoute('session.create')
  }
}
