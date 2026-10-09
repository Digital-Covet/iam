import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import User from './user.js'
import App from './app.js'

export default class AppEntitlement extends BaseModel {
  static table = 'app_entitlement'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare appId: string

  @column()
  declare enabled: boolean

  @column.dateTime()
  declare grantedAt: DateTime

  @column()
  declare grantedBy: string | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => App)
  declare app: BelongsTo<typeof App>

  @belongsTo(() => User, { foreignKey: 'grantedBy' })
  declare granter: BelongsTo<typeof User>
}
