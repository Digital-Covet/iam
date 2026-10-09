import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * One row per authorization a user gave a client, created when the
 * authorization code is redeemed. Access tokens carry the row id (`gid`), so
 * revoking the row stops them; the refresh token (only issued with the
 * `offline_access` scope) is stored here as a SHA-256 hash and rotates on use.
 * The previous hash is kept to spot a refresh token being replayed.
 */
export default class extends BaseSchema {
  protected tableName = 'oauth_grant'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('oauth_client_id')
        .notNullable()
        .references('id')
        .inTable('oauth_client')
        .onDelete('CASCADE')
      table.uuid('user_id').notNullable().references('id').inTable('user').onDelete('CASCADE')
      table.specificType('scopes', 'text[]').notNullable().defaultTo(this.raw(`'{}'::text[]`))

      table.text('refresh_token_hash').nullable().unique()
      table.text('previous_refresh_token_hash').nullable().unique()
      table.dateTime('refresh_expires_at', { useTz: true }).nullable()

      table.dateTime('last_used_at', { useTz: true }).nullable()
      table.dateTime('revoked_at', { useTz: true }).nullable()
      table.string('revoked_reason', 60).nullable()

      table.dateTime('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.dateTime('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index('user_id')
      table.index('oauth_client_id')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
