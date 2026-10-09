import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Server-side 2FA state that used to live in the (client-held) session:
 * a failure counter with lockout, and the last accepted TOTP time step so a
 * code can't be replayed inside its validity window.
 */
export default class extends BaseSchema {
  protected tableName = 'two_factor'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('failed_attempts').notNullable().defaultTo(0)
      table.dateTime('locked_until', { useTz: true }).nullable()
      // Unix time / 30. Fits an integer until the year 4000.
      table.integer('last_used_step').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('failed_attempts')
      table.dropColumn('locked_until')
      table.dropColumn('last_used_step')
    })
  }
}
