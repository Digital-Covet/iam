import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import User from './user.js'

export default class TwoFactor extends BaseModel {
  static table = 'two_factor'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column({ serializeAs: null })
  declare secretEncrypted: string

  @column({ serializeAs: null })
  declare backupCodesHashed: string[]

  @column()
  declare enabled: boolean

  @column.dateTime()
  declare verifiedAt: DateTime | null

  /** Wrong codes since the last success; every 5th starts a lockout. */
  @column({ serializeAs: null })
  declare failedAttempts: number

  @column.dateTime({ serializeAs: null })
  declare lockedUntil: DateTime | null

  /** TOTP time step (unix seconds / 30) of the last accepted code. */
  @column({ serializeAs: null })
  declare lastUsedStep: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
