import Role from '#models/role'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Permissions that stay superadmin-only by default. The seeder withholds them
 * from `admin`, and only a superadmin may grant them to another role in the
 * matrix. Everything else the console does is checked against role_permission.
 */
export const SUPERADMIN_ONLY_KEYS = new Set([
  'roles.create',
  'roles.delete',
  'apps.create',
  'apps.update',
  'apps.delete',
  'oauth.clients.manage',
  'settings.password_policy.update',
  'settings.auth_methods.update',
])

/** What the signed-in user's role allows. Superadmin always has every key. */
export class Access {
  constructor(
    readonly roleName: string,
    private readonly keys: ReadonlySet<string>
  ) {}

  get isSuperadmin() {
    return this.roleName === 'superadmin'
  }

  can(key: string) {
    return this.isSuperadmin || this.keys.has(key)
  }

  canAll(keys: string[]) {
    return keys.every((key) => this.can(key))
  }

  canAny(keys: string[]) {
    return keys.some((key) => this.can(key))
  }

  /** Keys to send to the client. Superadmin is flagged separately, not listed. */
  list() {
    return [...this.keys].sort()
  }
}

const cache = new WeakMap<HttpContext, Promise<Access>>()

/**
 * Access for the request's signed-in user, loaded once per request. Not
 * signed in means no role and no permissions.
 */
export function accessFor(ctx: HttpContext): Promise<Access> {
  let access = cache.get(ctx)
  if (!access) {
    access = load(ctx)
    cache.set(ctx, access)
  }
  return access
}

async function load(ctx: HttpContext): Promise<Access> {
  const user = ctx.auth.user
  if (!user) return new Access('', new Set())

  const role = await Role.query().where('id', user.roleId).preload('permissions').first()
  const roleName = role?.name?.toLowerCase() ?? 'employee'
  return new Access(roleName, new Set(role?.permissions.map((p) => p.key) ?? []))
}
