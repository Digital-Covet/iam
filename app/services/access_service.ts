import Role from '#models/role'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Sensitive permissions that a superadmin hands out deliberately. The seeder
 * withholds them from `admin`, and only a superadmin may grant them to another
 * role in the matrix. The seeded `developer` role is the exception: it owns the
 * app/OAuth keys by design. Everything else is checked against role_permission.
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

/**
 * Default grants for the `developer` role: ownership of the app registry and
 * its OAuth clients, plus read-only visibility across the rest of the console.
 * Shared with the backfill migration so both paths seed the same set.
 */
export const DEVELOPER_KEYS = new Set([
  'apps.read',
  'apps.create',
  'apps.update',
  'apps.delete',
  'oauth.clients.read',
  'oauth.clients.manage',
  'entitlements.read',
  'users.read',
  'roles.read',
  'audit.read',
  'settings.password_policy.read',
  'settings.auth_methods.read',
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
