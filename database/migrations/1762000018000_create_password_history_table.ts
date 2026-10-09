import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Retired password hashes, so `password_policy.history_count` can refuse a
 * password the person already used. Rows are only ever the hash that a change
 * replaced; the current hash stays on `account`.
 */
export default class extends BaseSchema {
  protected tableName = 'password_history'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('user_id').notNullable().references('id').inTable('user').onDelete('CASCADE')
      table.text('password_hash').notNullable()

      table.dateTime('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index(['user_id', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
