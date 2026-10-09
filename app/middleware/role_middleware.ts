import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Role gate for console routes. Runs after `auth`, so `ctx.auth.user` is set.
 * Usage: `.use(middleware.role({ roles: ['admin', 'superadmin'] }))`.
 * Superadmin always passes.
 */
export default class RoleMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: { roles: string[] }) {
    const { auth, request, response, session } = ctx
    const user = auth.getUserOrFail()
    await user.load('role')

    const roleName = user.role?.name?.toLowerCase() ?? 'employee'
    const allowed = options.roles.map((r) => r.toLowerCase())

    if (roleName === 'superadmin' || allowed.includes(roleName)) {
      return next()
    }

    if (request.header('x-inertia') === undefined && request.accepts(['html', 'json']) === 'json') {
      return response.forbidden({ error: 'You do not have access to this resource.' })
    }

    session.flash('error', 'You do not have access to that page.')
    return response.redirect('/dashboard')
  }
}
