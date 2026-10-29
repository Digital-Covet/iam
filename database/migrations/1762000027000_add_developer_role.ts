import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The `developer` role owns the app registry: it registers apps, manages their
 * OAuth clients and rotates secrets. It also gets read-only visibility across
 * the rest of the console. The app/OAuth keys stay in SUPERADMIN_ONLY_KEYS, so
 * an admin still cannot grant them — only a superadmin can.
 *
 * Existing databases need the role and its grants without a full reseed.
 * Key list mirrors DEVELOPER_KEYS in app/services/access_service.ts.
 */
const DEVELOPER_KEYS = [
  'apps.read',
  'apps.create',
  'apps.update',
  'apps.delete',
  'oauth.clients.read',
  'oauth.clients.manage',
  'entitlements.read',
  'users.read',
  'roles.read',
  'audit.read',
  'settings.password_policy.read',
  'settings.auth_methods.read',
]

export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db.rawQuery(
        `insert into role (name, description, is_system)
         values (?, ?, true)
         on conflict (name) do nothing`,
        ['developer', 'Builds and maintains the apps that sign in through IAM']
      )

      await db.rawQuery(
        `insert into role_permission (role_id, permission_id)
         select r.id, p.id
         from role r, permission p
         where lower(r.name) = 'developer'
           and p.key = any(?)
         on conflict do nothing`,
        [DEVELOPER_KEYS]
      )
    })
  }

  async down() {
    this.defer(async (db) => {
      // Move anyone holding the role to employee (or admin) before removing it.
      await db.rawQuery(
        `update "user"
         set role_id = coalesce(
           (select id from role where lower(name) = 'employee' limit 1),
           (select id from role where lower(name) = 'admin' limit 1)
         )
         where role_id = (select id from role where lower(name) = 'developer' limit 1)`
      )
      // role_permission rows cascade with the role.
      await db.rawQuery(`delete from role where lower(name) = 'developer' and is_system = true`)
    })
  }
}
