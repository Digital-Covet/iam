import { twoFactorRequired } from '#services/two_factor_policy'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

const EXEMPT_PREFIXES = ['/setup-2fa', '/logout', '/account-settings/sessions']

/**
 * Org-wide "everyone must use 2FA" enforcement. When the policy is on and the
 * signed-in user hasn't enrolled, every console route (and the OAuth consent
 * step) bounces to /setup-2fa until they enroll.
 */
export default class RequireTwoFactorMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.user
    if (user && (await twoFactorRequired())) {
      await user.load('twoFactor').catch(() => {})
      if (!user.twoFactor?.enabled) {
        const path = ctx.request.url()
        if (!EXEMPT_PREFIXES.some((p) => path.startsWith(p))) {
          ctx.session.flash(
            'error',
            'Your organization requires two-factor. Set it up to continue.'
          )
          return ctx.response.redirect().toRoute('two_factor.createSetup')
        }
      }
    }
    return next()
  }
}
