import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The user-facing `/apps` launcher needs somewhere to send people. A nullable
 * home URL keeps existing apps valid while letting each app advertise its
 * canonical entry point. Seeded apps are backfilled below.
 */
const HOME_URLS: Record<string, string> = {
  share: 'https://share.digitalcovet.com',
  portfolio: 'https://portfolio.digitalcovet.com',
  desk: 'https://desk.flonion.com',
}

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('app', (table) => {
      table.string('home_url', 2000).nullable()
    })

    this.defer(async (db) => {
      for (const [slug, homeUrl] of Object.entries(HOME_URLS)) {
        await db.from('app').whereRaw('lower(slug) = ?', [slug]).update({ home_url: homeUrl })
      }
    })
  }

  async down() {
    this.schema.alterTable('app', (table) => {
      table.dropColumn('home_url')
    })
  }
}
