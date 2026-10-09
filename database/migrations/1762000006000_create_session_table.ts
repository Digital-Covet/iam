import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'session'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('user_id').notNullable().references('id').inTable('user').onDelete('CASCADE')
      table.text('token').notNullable().unique()
      table.dateTime('expires_at', { useTz: true }).notNullable()
      table.specificType('ip_address', 'inet').nullable()
      table.text('user_agent').nullable()
      table.jsonb('geo').nullable()

      table.dateTime('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.dateTime('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index('user_id')
      table.index('expires_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
