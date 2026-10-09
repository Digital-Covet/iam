import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'role_permission'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('role_id').notNullable().references('id').inTable('role').onDelete('CASCADE')
      table
        .uuid('permission_id')
        .notNullable()
        .references('id')
        .inTable('permission')
        .onDelete('CASCADE')

      table.primary(['role_id', 'permission_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
