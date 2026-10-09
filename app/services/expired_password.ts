import SessionTracker from '#services/session_tracker'
import TokenService from '#services/token_service'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * The credentials were right but the password has expired: hand out a
 * one-time reset link instead of signing in. Callers must run the 2FA
 * challenge first for accounts that have it.
 */
export async function redirectToPasswordReset(ctx: HttpContext, userId: string) {
  await SessionTracker.audit(ctx, {
    action: 'auth.login_blocked',
    actorId: userId,
    status: 'failure',
    metadata: { reason: 'password_expired' },
  })
  const token = await TokenService.issue(userId, 'reset')
  ctx.session.flash('error', 'Your password has expired. Choose a new one to continue.')
  return ctx.response.redirect(`/reset-password/${token}`)
}
