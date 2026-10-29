import AppEntitlement from '#models/app_entitlement'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * User-facing Apps page — `/apps`. Lists only the active apps this person has
 * an enabled entitlement to, with a link out to each app. Every signed-in user
 * gets this page; managing the apps themselves lives at `/developer/apps`.
 */
export default class AppLauncherController {
  async index({ inertia, auth }: HttpContext) {
    const user = auth.getUserOrFail()

    const grants = await AppEntitlement.query()
      .where('user_id', user.id)
      .where('enabled', true)
      .whereHas('app', (query) => {
        query.where('is_active', true).whereNull('deleted_at')
      })
      .preload('app')

    const apps = grants
      .map((grant) => grant.app)
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((app) => ({
        id: app.id,
        slug: app.slug.toLowerCase(),
        name: app.name,
        description: app.description,
        homeUrl: app.homeUrl,
      }))

    return inertia.render('apps', { apps })
  }
}
