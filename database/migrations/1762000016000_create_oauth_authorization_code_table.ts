import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Single-use authorization codes issued by /consent/approve and redeemed at
 * /oauth/token. Only the SHA-256 of the code is stored.
 */
export default class extends BaseSchema {
  protected tableName = 'oauth_authorization_code'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.text('code_hash').notNullable().unique()
      table
        .uuid('oauth_client_id')
        .notNullable()
        .references('id')
        .inTable('oauth_client')
        .onDelete('CASCADE')
      table.uuid('user_id').notNullable().references('id').inTable('user').onDelete('CASCADE')
      table.text('redirect_uri').notNullable()
      table.specificType('scopes', 'text[]').notNullable().defaultTo(this.raw(`'{}'::text[]`))
      table.text('code_challenge').nullable()
      table.string('code_challenge_method', 10).nullable()
      table.text('nonce').nullable()
      table.dateTime('expires_at', { useTz: true }).notNullable()
      table.dateTime('used_at', { useTz: true }).nullable()
      table.dateTime('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index('user_id')
      table.index('expires_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
