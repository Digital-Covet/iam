import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Role from './role.js'
import Permission from './permission.js'

export default class RolePermission extends BaseModel {
  static table = 'role_permission'

  @column({ isPrimary: true })
  declare roleId: string

  @column({ isPrimary: true })
  declare permissionId: string

  @belongsTo(() => Role)
  declare role: BelongsTo<typeof Role>

  @belongsTo(() => Permission)
  declare permission: BelongsTo<typeof Permission>
}
