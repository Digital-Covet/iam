import { type HttpContext } from '@adonisjs/core/http'
import { type NextFn } from '@adonisjs/core/types/http'

/**
 * Keeps every response, including JSON and static files, out of search
 * indexes. This is an internal identity provider, not a public site.
 */
export default class RobotsTagMiddleware {
  async handle({ response }: HttpContext, next: NextFn) {
    response.header('X-Robots-Tag', 'noindex, nofollow')
    return next()
  }
}
