/*
|--------------------------------------------------------------------------
| Define HTTP limiters
|--------------------------------------------------------------------------
|
| The "limiter.define" method creates an HTTP middleware to apply rate
| limits on a route or a group of routes. These run before the controller,
| so they cap guessing even where the 2FA lockout (which lives in the
| `two_factor` row) does not apply, such as the password step.
|
*/

import limiter from '@adonisjs/limiter/services/main'

/** One IP spraying many accounts. Generous, so a shared office IP is not locked out. */
export const loginIpThrottle = limiter.define('login_ip', (ctx) => {
  return limiter
    .allowRequests(100)
    .every('15 minutes')
    .usingKey(`ip_${ctx.request.ip()}`)
})

/** Password guessing against one account from one IP. */
export const loginThrottle = limiter.define('login', (ctx) => {
  const email = String(ctx.request.input('email') ?? '')
    .trim()
    .toLowerCase()
    .slice(0, 254)
  return limiter
    .allowRequests(10)
    .every('1 minute')
    .blockFor('15 minutes')
    .usingKey(`ip_${ctx.request.ip()}_${email}`)
})

/** Second-factor guessing. The per-account lockout is the real limit; this caps bursts. */
export const verifyTwoFactorThrottle = limiter.define('verify_2fa', (ctx) => {
  const pending = String(ctx.session.get('two_factor_pending_user_id') ?? 'none')
  return limiter
    .allowRequests(10)
    .every('1 minute')
    .blockFor('15 minutes')
    .usingKey(`ip_${ctx.request.ip()}_${pending}`)
})

/** Signed-in 2FA changes that ask for a password or code (enable, regenerate, disable). */
export const twoFactorManageThrottle = limiter.define('manage_2fa', (ctx) => {
  return limiter
    .allowRequests(10)
    .every('15 minutes')
    .usingKey(`user_${ctx.auth.user?.id ?? ctx.request.ip()}`)
})
