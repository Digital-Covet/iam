import app from '@adonisjs/core/services/app'
import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import type { StatusPageRange, StatusPageRenderer } from '@adonisjs/core/types/http'
import { errors as limiterErrors } from '@adonisjs/limiter'

/** An Inertia visit or a plain browser form post, as opposed to an API call. */
function wantsPage(ctx: HttpContext) {
  if (!('session' in ctx) || !ctx.session) return false
  return (
    ctx.request.header('x-inertia') !== undefined ||
    ctx.request.accepts(['html', 'json']) === 'html'
  )
}

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * Status pages are used to display a custom HTML pages for certain error
   * codes. You might want to enable them in production only, but feel
   * free to enable them in development as well.
   */
  protected renderStatusPages = app.inProduction

  /**
   * Status pages is a collection of error code range and a callback
   * to return the HTML contents to send as a response.
   */
  protected statusPages: Record<StatusPageRange, StatusPageRenderer> = {
    '404': (_, { inertia }) => inertia.render('errors/not_found', {}),
    '500..599': (_, { inertia }) => inertia.render('errors/server_error', {}),
  }

  /**
   * The method is used for handling errors and returning
   * response to the client
   */
  async handle(error: unknown, ctx: HttpContext) {
    // Throttled form posts (login, 2FA) go back to the form with a message
    // instead of a bare 429 page. API clients still get the JSON 429.
    if (error instanceof limiterErrors.E_TOO_MANY_REQUESTS && wantsPage(ctx)) {
      const seconds = Math.max(1, Math.ceil(error.response.availableIn))
      const wait = seconds < 90 ? `${seconds} seconds` : `${Math.ceil(seconds / 60)} minutes`
      ctx.session.flash('error', `Too many attempts. Try again in ${wait}.`)
      return ctx.response.redirect().back()
    }
    return super.handle(error, ctx)
  }

  /**
   * The method is used to report error to the logging service or
   * the a third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   */
  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
