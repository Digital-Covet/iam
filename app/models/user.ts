import { BaseModel, column, belongsTo, hasMany, hasOne } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, HasOne } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import Role from './role.js'
import Session from './session.js'
import Account from './account.js'
import TwoFactor from './two_factor.js'
import AppEntitlement from './app_entitlement.js'
import AuditLog from './audit_log.js'
import Verification from './verification.js'

/**
 * Canonical identity. Better Auth compatible (`user`) plus IAM extensions.
 */
export default class User extends BaseModel {
  static table = 'user'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare email: string

  @column()
  declare name: string | null

  @column()
  declare image: string | null

  /** Object key inside the avatar bucket; null for photos uploaded before this was tracked. */
  @column()
  declare avatarPath: string | null

  @column()
  declare emailVerified: boolean

  @column.dateTime()
  declare emailVerifiedAt: DateTime | null

  @column()
  declare roleId: string

  @column.dateTime()
  declare bannedAt: DateTime | null

  @column()
  declare banReason: string | null

  @column.dateTime()
  declare deletedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Role)
  declare role: BelongsTo<typeof Role>

  @hasMany(() => Session)
  declare sessions: HasMany<typeof Session>

  @hasMany(() => Account)
  declare accounts: HasMany<typeof Account>

  @hasMany(() => Verification)
  declare verifications: HasMany<typeof Verification>

  @hasOne(() => TwoFactor)
  declare twoFactor: HasOne<typeof TwoFactor>

  @hasMany(() => AppEntitlement)
  declare appEntitlements: HasMany<typeof AppEntitlement>

  @hasMany(() => AuditLog, { foreignKey: 'actorId' })
  declare auditLogs: HasMany<typeof AuditLog>

  get initials() {
    const source = this.name?.trim() || this.email.split('@')[0]
    const parts = source.split(/[\s._-]+/).filter(Boolean)
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return source.slice(0, 2).toUpperCase()
  }
}
