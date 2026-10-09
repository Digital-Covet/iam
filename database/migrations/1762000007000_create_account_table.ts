import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Stores credentials and linked OAuth providers. Better Auth compatible (`account`).
 * The credential provider stores the password hash; other providers store tokens.
 */
export default class extends BaseSchema {
  protected tableName = 'account'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('user_id').notNullable().references('id').inTable('user').onDelete('CASCADE')
      table.text('account_id').notNullable()
      table.text('provider_id').notNullable()
      table.text('access_token').nullable()
      table.text('refresh_token').nullable()
      table.text('id_token').nullable()
      table.dateTime('access_token_expires_at', { useTz: true }).nullable()
      table.dateTime('refresh_token_expires_at', { useTz: true }).nullable()
      table.text('scope').nullable()
      table.text('password_hash').nullable()

      table.dateTime('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.dateTime('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['provider_id', 'account_id'])
      table.index('user_id')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
