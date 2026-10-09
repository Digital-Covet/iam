import { accessFor } from '#services/access_service'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

type Options = {
  /** The user must hold every one of these. */
  all?: string[]
  /** The user must hold at least one of these. */
  any?: string[]
}

/**
 * Permission gate for console routes. Runs after `auth`. Checks the signed-in
 * user's role against role_permission; superadmin always passes.
 * Usage: `.use(middleware.permission({ all: ['users.read'] }))`.
 */
export default class PermissionMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: Options) {
    const { request, response, session } = ctx
    const access = await accessFor(ctx)

    const allowed =
      (!options.all || access.canAll(options.all)) && (!options.any || access.canAny(options.any))
    if (allowed) return next()

    if (request.header('x-inertia') === undefined && request.accepts(['html', 'json']) === 'json') {
      return response.forbidden({ error: 'You do not have access to this resource.' })
    }

    session.flash('error', 'You do not have access to that page.')
    return response.redirect('/dashboard')
  }
}
