import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Email OTP and verification tokens. Better Auth compatible (`verification`).
 * Intentionally not linked to `user`; Better Auth keys these by `identifier`.
 */
export default class extends BaseSchema {
  protected tableName = 'verification'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('user_id').nullable().references('id').inTable('user').onDelete('CASCADE')
      table.text('identifier').notNullable()
      table.text('value').notNullable()
      table.dateTime('expires_at', { useTz: true }).notNullable()

      table.dateTime('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.dateTime('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index('user_id')
      table.index('identifier')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
