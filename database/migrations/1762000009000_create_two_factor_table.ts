import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * TOTP secret and hashed backup codes. One row per user.
 */
export default class extends BaseSchema {
  protected tableName = 'two_factor'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('user_id').notNullable().references('id').inTable('user').onDelete('CASCADE')
      table.text('secret_encrypted').notNullable()
      table
        .specificType('backup_codes_hashed', 'text[]')
        .notNullable()
        .defaultTo(this.raw(`'{}'::text[]`))
      table.boolean('enabled').notNullable().defaultTo(false)
      table.dateTime('verified_at', { useTz: true }).nullable()

      table.dateTime('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.dateTime('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['user_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
