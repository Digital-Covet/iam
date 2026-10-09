import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * When and how the user signed in, captured at consent so the ID token can
 * carry the real `auth_time` and an `amr` claim (RFC 8176).
 */
export default class extends BaseSchema {
  protected tableName = 'oauth_authorization_code'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dateTime('auth_time', { useTz: true }).nullable()
      table.specificType('amr', 'text[]').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('auth_time')
      table.dropColumn('amr')
    })
  }
}
