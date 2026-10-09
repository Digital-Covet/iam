import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Permissions are now enforced on every console route. Until now the code
 * hardcoded these actions as superadmin-only while the seed gave `admin` the
 * matching keys, so admins would silently gain them. Remove those grants from
 * the system `admin` role so behaviour stays the same; a superadmin can grant
 * any of them back in Roles & access.
 */
const SUPERADMIN_ONLY_KEYS = [
  'roles.create',
  'roles.delete',
  'apps.create',
  'apps.update',
  'apps.delete',
  'oauth.clients.manage',
  'settings.password_policy.update',
  'settings.auth_methods.update',
]

export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db.rawQuery(
        `delete from role_permission
         where role_id in (select id from role where lower(name) = 'admin' and is_system)
           and permission_id in (select id from permission where key = any(?))`,
        [SUPERADMIN_ONLY_KEYS]
      )
    })
  }

  async down() {
    // The removed grants cannot be told apart from ones a superadmin made, so
    // there is nothing safe to restore. Re-run the seeder to reset defaults.
  }
}
