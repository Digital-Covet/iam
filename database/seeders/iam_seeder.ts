import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Role from '#models/role'
import Permission from '#models/permission'
import App from '#models/app'
import PasswordPolicy from '#models/password_policy'
import AuthMethod from '#models/auth_method'
import { DEVELOPER_KEYS, SUPERADMIN_ONLY_KEYS } from '#services/access_service'

/**
 * Sectioned permission catalogue. `section` groups permissions in the UI.
 */
const PERMISSIONS = [
  { key: 'users.read', section: 'users', description: 'View users' },
  { key: 'users.create', section: 'users', description: 'Create users' },
  { key: 'users.update', section: 'users', description: 'Update users' },
  { key: 'users.delete', section: 'users', description: 'Delete users' },
  { key: 'users.mfa.reset', section: 'users', description: 'Reset another person’s two-factor' },

  { key: 'roles.read', section: 'roles', description: 'View roles' },
  { key: 'roles.create', section: 'roles', description: 'Create roles' },
  { key: 'roles.update', section: 'roles', description: 'Update roles' },
  { key: 'roles.delete', section: 'roles', description: 'Delete roles' },

  { key: 'apps.read', section: 'apps', description: 'View applications' },
  { key: 'apps.create', section: 'apps', description: 'Create applications' },
  { key: 'apps.update', section: 'apps', description: 'Update applications' },
  { key: 'apps.delete', section: 'apps', description: 'Delete applications' },

  { key: 'sessions.read', section: 'sessions', description: 'View sessions' },
  { key: 'sessions.revoke', section: 'sessions', description: 'Revoke any session' },

  {
    key: 'entitlements.read',
    section: 'entitlements',
    description: 'View app entitlements',
  },
  {
    key: 'entitlements.grant',
    section: 'entitlements',
    description: 'Grant app access',
  },
  {
    key: 'entitlements.revoke',
    section: 'entitlements',
    description: 'Revoke app access',
  },

  { key: 'oauth.clients.read', section: 'oauth', description: 'View OAuth clients' },
  { key: 'oauth.clients.manage', section: 'oauth', description: 'Manage OAuth clients' },

  { key: 'audit.read', section: 'audit', description: 'View the audit log' },
  { key: 'audit.export', section: 'audit', description: 'Export the audit log as CSV' },

  {
    key: 'settings.password_policy.read',
    section: 'settings',
    description: 'View the password policy',
  },
  {
    key: 'settings.password_policy.update',
    section: 'settings',
    description: 'Update the password policy',
  },
  {
    key: 'settings.auth_methods.read',
    section: 'settings',
    description: 'View enabled auth methods',
  },
  {
    key: 'settings.auth_methods.update',
    section: 'settings',
    description: 'Update enabled auth methods',
  },
]

/**
 * The `admin` role gets everything except the sensitive keys (role
 * creation/deletion, app and OAuth client management, global settings writes).
 * App/OAuth management belongs to the `developer` role.
 */
const ADMIN_EXCLUDED = SUPERADMIN_ONLY_KEYS

const EMPLOYEE_KEYS = new Set(['apps.read'])

export default class IamSeeder extends BaseSeeder {
  async run() {
    await Role.updateOrCreateMany('name', [
      { name: 'superadmin', description: 'Full, unrestricted access', isSystem: true },
      { name: 'admin', description: 'Administrative access', isSystem: true },
      {
        name: 'developer',
        description: 'Builds and maintains the apps that sign in through IAM',
        isSystem: true,
      },
      { name: 'employee', description: 'Standard access', isSystem: true },
    ])

    await Permission.updateOrCreateMany('key', PERMISSIONS)

    const roles = await Role.all()
    const permissions = await Permission.all()
    const permissionIdByKey = new Map(
      permissions.map((permission) => [permission.key, permission.id])
    )
    const roleByName = new Map(roles.map((role) => [role.name, role]))

    const superadminIds = PERMISSIONS.map((permission) => permissionIdByKey.get(permission.key)!)
    const adminIds = PERMISSIONS.filter((permission) => !ADMIN_EXCLUDED.has(permission.key)).map(
      (permission) => permissionIdByKey.get(permission.key)!
    )
    const employeeIds = PERMISSIONS.filter((permission) => EMPLOYEE_KEYS.has(permission.key)).map(
      (permission) => permissionIdByKey.get(permission.key)!
    )
    const developerIds = PERMISSIONS.filter((permission) => DEVELOPER_KEYS.has(permission.key)).map(
      (permission) => permissionIdByKey.get(permission.key)!
    )

    await roleByName.get('superadmin')!.related('permissions').sync(superadminIds)
    await roleByName.get('admin')!.related('permissions').sync(adminIds)
    await roleByName.get('developer')!.related('permissions').sync(developerIds)
    await roleByName.get('employee')!.related('permissions').sync(employeeIds)

    await App.updateOrCreateMany('slug', [
      {
        slug: 'share',
        name: 'Share',
        description: 'Content sharing workspace',
        homeUrl: 'https://share.digitalcovet.com',
        isActive: true,
      },
      {
        slug: 'portfolio',
        name: 'Portfolio',
        description: 'Portfolio management',
        homeUrl: 'https://portfolio.digitalcovet.com',
        isActive: true,
      },
      {
        slug: 'desk',
        name: 'Desk',
        description: 'Support and operations desk',
        homeUrl: 'https://desk.flonion.com',
        isActive: true,
      },
    ])

    const existingPolicy = await PasswordPolicy.first()
    if (!existingPolicy) {
      await PasswordPolicy.create({
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumber: true,
        requireSpecial: false,
        maxAgeDays: null,
        historyCount: 0,
        extraRules: {},
      })
    }

    await AuthMethod.updateOrCreateMany('key', [
      { key: 'credential', name: 'Email & Password', enabled: true, config: {} },
      { key: 'google', name: 'Google', enabled: false, config: {} },
      { key: 'github', name: 'GitHub', enabled: false, config: {} },
      { key: 'oidc', name: 'OpenID Connect', enabled: false, config: {} },
      { key: 'totp', name: 'Authenticator (TOTP)', enabled: true, config: {} },
      { key: 'email_otp', name: 'Email OTP', enabled: false, config: {} },
    ])
  }
}
