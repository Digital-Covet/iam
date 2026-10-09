import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Canonical identity table. Shape is Better Auth compatible (`user`)
 * with IAM extensions for role assignment, banning and soft deletes.
 */
export default class extends BaseSchema {
  protected tableName = 'user'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.specificType('email', 'citext').notNullable().unique()
      table.text('name').nullable()
      table.text('image').nullable()
      table.boolean('email_verified').notNullable().defaultTo(false)
      table.dateTime('email_verified_at', { useTz: true }).nullable()

      table.uuid('role_id').notNullable().references('id').inTable('role').onDelete('RESTRICT')

      table.dateTime('banned_at', { useTz: true }).nullable()
      table.text('ban_reason').nullable()
      table.dateTime('deleted_at', { useTz: true }).nullable()

      table.dateTime('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.dateTime('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index('role_id')
      table.index('deleted_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
