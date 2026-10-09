import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Append-only audit trail. Intentionally has no `updated_at`.
 * Enforce immutability with privileges/RLS (see migration notes in README).
 */
export default class extends BaseSchema {
  protected tableName = 'audit_log'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('actor_id').nullable().references('id').inTable('user').onDelete('SET NULL')
      table.string('action', 120).notNullable()
      table.string('resource_type', 80).nullable()
      table.text('resource_id').nullable()
      table.string('status', 40).notNullable()
      table.specificType('ip_address', 'inet').nullable()
      table.jsonb('geo').nullable()
      table.jsonb('metadata').notNullable().defaultTo(this.raw(`'{}'::jsonb`))

      table.dateTime('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index('actor_id')
      table.index('action')
      table.index(['resource_type', 'resource_id'])
      table.index('created_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
