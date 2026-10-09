import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * When the stored password last changed, for `password_policy.max_age_days`.
 * `updated_at` can't serve: it moves on any save. Existing rows start the
 * clock at migration time, so turning expiry on never locks anyone out.
 */
export default class extends BaseSchema {
  protected tableName = 'account'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dateTime('password_changed_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('password_changed_at')
    })
  }
}
