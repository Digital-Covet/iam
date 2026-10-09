import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Singleton-style configurable password rules.
 */
export default class extends BaseSchema {
  protected tableName = 'password_policy'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.integer('min_length').notNullable().defaultTo(8)
      table.boolean('require_uppercase').notNullable().defaultTo(true)
      table.boolean('require_lowercase').notNullable().defaultTo(true)
      table.boolean('require_number').notNullable().defaultTo(true)
      table.boolean('require_special').notNullable().defaultTo(false)
      table.integer('max_age_days').nullable()
      table.integer('history_count').notNullable().defaultTo(0)
      table.jsonb('extra_rules').notNullable().defaultTo(this.raw(`'{}'::jsonb`))

      table.dateTime('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.uuid('updated_by').nullable().references('id').inTable('user').onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
