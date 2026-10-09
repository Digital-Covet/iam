import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Registry of enabled authentication methods.
 */
export default class extends BaseSchema {
  protected tableName = 'auth_method'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('key', 60).notNullable().unique()
      table.string('name', 120).notNullable()
      table.boolean('enabled').notNullable().defaultTo(true)
      table.jsonb('config').notNullable().defaultTo(this.raw(`'{}'::jsonb`))

      table.dateTime('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
