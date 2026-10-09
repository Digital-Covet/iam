import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'app'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('slug', 80).notNullable().unique()
      table.string('name', 120).notNullable()
      table.text('description').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)

      table.dateTime('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.dateTime('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.dateTime('deleted_at', { useTz: true }).nullable()

      table.index('deleted_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
