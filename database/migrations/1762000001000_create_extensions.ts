import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Installs PostgreSQL extensions required by the IAM schema.
 * - citext: case-insensitive text for emails
 *
 * `gen_random_uuid()` is part of PostgreSQL 13+ core and does not need pgcrypto.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw('CREATE EXTENSION IF NOT EXISTS "citext"')
  }

  async down() {
    this.schema.raw('DROP EXTENSION IF EXISTS "citext"')
  }
}
