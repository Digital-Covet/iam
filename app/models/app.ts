import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import AppEntitlement from './app_entitlement.js'
import OAuthClient from './oauth_client.js'

export default class App extends BaseModel {
  static table = 'app'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare slug: string

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column.dateTime()
  declare deletedAt: DateTime | null

  @hasMany(() => AppEntitlement)
  declare entitlements: HasMany<typeof AppEntitlement>

  @hasMany(() => OAuthClient)
  declare oauthClients: HasMany<typeof OAuthClient>
}
