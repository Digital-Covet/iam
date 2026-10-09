import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Where the profile photo lives in Supabase Storage (`<bucket>/<path>`).
 * `image` is only the public URL, which can't be reliably turned back into an
 * object key; this column lets us replace or delete the file instead of
 * leaving orphans behind. Existing photos keep a null path.
 */
export default class extends BaseSchema {
  protected tableName = 'user'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('avatar_path').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('avatar_path')
    })
  }
}
