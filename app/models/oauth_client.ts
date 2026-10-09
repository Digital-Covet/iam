import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import App from './app.js'

export default class OAuthClient extends BaseModel {
  static table = 'oauth_client'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare appId: string | null

  @column()
  declare clientId: string

  @column({ serializeAs: null })
  declare clientSecretHash: string | null

  @column()
  declare redirectUris: string[]

  @column()
  declare postLogoutRedirectUris: string[]

  @column()
  declare tokenEndpointAuthMethod: string

  @column()
  declare requirePkce: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column.dateTime()
  declare deletedAt: DateTime | null

  @belongsTo(() => App)
  declare app: BelongsTo<typeof App>
}
