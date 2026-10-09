import { BaseModel, beforeCreate, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import { deriveSeverity, type AuditSeverity } from '#services/audit_severity'
import User from './user.js'

/**
 * Append-only audit trail. Never updated after insert.
 */
export default class AuditLog extends BaseModel {
  static table = 'audit_log'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare actorId: string | null

  @column()
  declare action: string

  @column()
  declare resourceType: string | null

  @column()
  declare resourceId: string | null

  @column()
  declare status: string

  /** info | notice | critical. Derived on create unless the caller sets it. */
  @column()
  declare severity: AuditSeverity

  @column()
  declare ipAddress: string | null

  @column()
  declare geo: Record<string, any> | null

  @column()
  declare metadata: Record<string, any>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => User, { foreignKey: 'actorId' })
  declare actor: BelongsTo<typeof User>

  @beforeCreate()
  static assignSeverity(log: AuditLog) {
    if (!log.severity) log.severity = deriveSeverity(log.status, log.action)
  }
}
