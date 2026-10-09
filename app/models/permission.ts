import { BaseModel, column, manyToMany, hasMany } from '@adonisjs/lucid/orm'
import type { ManyToMany, HasMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import Role from './role.js'
import RolePermission from './role_permission.js'

export default class Permission extends BaseModel {
  static table = 'permission'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare key: string

  @column()
  declare section: string

  @column()
  declare description: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @manyToMany(() => Role, {
    pivotTable: 'role_permission',
  })
  declare roles: ManyToMany<typeof Role>

  @hasMany(() => RolePermission)
  declare rolePermissions: HasMany<typeof RolePermission>
}
