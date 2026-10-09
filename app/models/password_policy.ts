import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import User from './user.js'

export default class PasswordPolicy extends BaseModel {
  static table = 'password_policy'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare minLength: number

  @column()
  declare requireUppercase: boolean

  @column()
  declare requireLowercase: boolean

  @column()
  declare requireNumber: boolean

  @column()
  declare requireSpecial: boolean

  @column()
  declare maxAgeDays: number | null

  @column()
  declare historyCount: number

  @column()
  declare extraRules: Record<string, any>

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column()
  declare updatedBy: string | null

  @belongsTo(() => User, { foreignKey: 'updatedBy' })
  declare updatedByUser: BelongsTo<typeof User>
}
