import { BaseModel, column, manyToMany, hasMany } from '@adonisjs/lucid/orm'
import type { ManyToMany, HasMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import Permission from './permission.js'
import User from './user.js'
import RolePermission from './role_permission.js'

export default class Role extends BaseModel {
  static table = 'role'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare isSystem: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @manyToMany(() => Permission, {
    pivotTable: 'role_permission',
  })
  declare permissions: ManyToMany<typeof Permission>

  @hasMany(() => RolePermission)
  declare rolePermissions: HasMany<typeof RolePermission>

  @hasMany(() => User)
  declare users: HasMany<typeof User>
}
