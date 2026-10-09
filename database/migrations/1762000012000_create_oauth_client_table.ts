import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'oauth_client'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('app_id').nullable().references('id').inTable('app').onDelete('SET NULL')
      table.text('client_id').notNullable().unique()
      table.text('client_secret_hash').nullable()
      table
        .specificType('redirect_uris', 'text[]')
        .notNullable()
        .defaultTo(this.raw(`'{}'::text[]`))
      table
        .specificType('post_logout_redirect_uris', 'text[]')
        .notNullable()
        .defaultTo(this.raw(`'{}'::text[]`))
      table.string('token_endpoint_auth_method', 40).notNullable().defaultTo('client_secret_basic')
      table.boolean('require_pkce').notNullable().defaultTo(true)

      table.dateTime('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.dateTime('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.dateTime('deleted_at', { useTz: true }).nullable()

      table.index('app_id')
      table.index('deleted_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
