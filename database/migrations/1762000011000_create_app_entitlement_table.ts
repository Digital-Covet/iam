import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Per-user application access grant.
 */
export default class extends BaseSchema {
  protected tableName = 'app_entitlement'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('user_id').notNullable().references('id').inTable('user').onDelete('CASCADE')
      table.uuid('app_id').notNullable().references('id').inTable('app').onDelete('CASCADE')
      table.boolean('enabled').notNullable().defaultTo(true)
      table.dateTime('granted_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.uuid('granted_by').nullable().references('id').inTable('user').onDelete('SET NULL')

      table.unique(['user_id', 'app_id'])
      table.index('app_id')
      table.index('granted_by')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
