import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Stored severity for audit events (info | notice | critical). New rows get
 * theirs from the AuditLog model; existing rows are backfilled with the same
 * rules as `deriveSeverity` in app/services/audit_severity.ts.
 */
export default class extends BaseSchema {
  protected tableName = 'audit_log'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('severity', 20).notNullable().defaultTo('info')
      table.index('severity')
    })

    this.defer(async (db) => {
      await db.rawQuery(
        `update audit_log set severity = case
           when status <> 'success' then 'critical'
           when action ~* 'role|permission|entitlement|grant|revoke|suspend|delete|violation|policy|secret|token' then 'notice'
           else 'info'
         end`
      )
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex('severity')
      table.dropColumn('severity')
    })
  }
}
