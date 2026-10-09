import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `users.mfa.reset` lets an admin clear someone's two-factor after they lose
 * their device and backup codes. It is superadmin-only by default (no role
 * gets it here); a superadmin can grant it in Roles & access.
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db.rawQuery(
        `insert into permission (key, section, description)
         values (?, ?, ?)
         on conflict (key) do nothing`,
        ['users.mfa.reset', 'users', 'Reset another person’s two-factor']
      )
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(
        `delete from role_permission
         where permission_id in (select id from permission where key = ?)`,
        ['users.mfa.reset']
      )
      await db.rawQuery(`delete from permission where key = ?`, ['users.mfa.reset'])
    })
  }
}
