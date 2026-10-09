import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import User from './user.js'

export default class Account extends BaseModel {
  static table = 'account'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare accountId: string

  @column()
  declare providerId: string

  @column({ serializeAs: null })
  declare accessToken: string | null

  @column({ serializeAs: null })
  declare refreshToken: string | null

  @column({ serializeAs: null })
  declare idToken: string | null

  @column.dateTime()
  declare accessTokenExpiresAt: DateTime | null

  @column.dateTime()
  declare refreshTokenExpiresAt: DateTime | null

  @column()
  declare scope: string | null

  @column({ serializeAs: null })
  declare passwordHash: string | null

  @column.dateTime()
  declare passwordChangedAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
