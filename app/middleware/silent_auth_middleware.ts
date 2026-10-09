import SessionTracker from '#services/session_tracker'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Silent auth middleware can be used as a global middleware to silent check
 * if the user is logged-in or not.
 *
 * The request continues as usual, even when the user is not logged-in. A
 * signed-in browser whose `session` row was revoked is signed out here, so
 * every route (guarded or not) sees it as logged out.
 */
export default class SilentAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    await ctx.auth.check()

    const user = ctx.auth.use('web').user
    if (user && (await SessionTracker.validate(ctx, user)) === 'revoked') {
      await ctx.auth.use('web').logout()
      ctx.session.flash(
        'error',
        user.bannedAt || user.deletedAt
          ? 'Your account is suspended. Contact an administrator.'
          : 'You were signed out. Sign in again.'
      )
    }

    return next()
  }
}
