/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import {
  loginIpThrottle,
  loginThrottle,
  twoFactorManageThrottle,
  verifyTwoFactorThrottle,
} from '#start/limiter'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'

const DirectoryController = () => import('#controllers/directory_controller')
const DashboardController = () => import('#controllers/dashboard_controller')
const AppsController = () => import('#controllers/apps_controller')
const AuditLogsController = () => import('#controllers/audit_logs_controller')
const RolesAccessController = () => import('#controllers/roles_access_controller')
const TwoFactorController = () => import('#controllers/two_factor_controller')
const AccountSettingsController = () => import('#controllers/account_settings_controller')
const AuthSettingsController = () => import('#controllers/auth_settings_controller')
const ConsentController = () => import('#controllers/consent_controller')
const PasswordController = () => import('#controllers/password_controller')
const OAuthController = () => import('#controllers/oauth_controller')

/**
 * OAuth 2.0 / OIDC provider. `authorize` bounces signed-out users through
 * /login itself; token/userinfo authenticate via client credentials / Bearer.
 */
router.get('oauth/authorize', [OAuthController, 'authorize'])
router.post('oauth/token', [OAuthController, 'token'])
router.post('oauth/revoke', [OAuthController, 'revoke'])
router.post('oauth/introspect', [OAuthController, 'introspect'])
router.get('oauth/logout', [OAuthController, 'logout'])
router.post('oauth/logout', [OAuthController, 'confirmLogout'])
router.get('oauth/userinfo', [OAuthController, 'userinfo'])
router.get('.well-known/jwks.json', [OAuthController, 'jwks'])
router.get('.well-known/openid-configuration', [OAuthController, 'discovery'])

/**
 * Reset/set-password links are opened from email, possibly while signed in
 * as someone else, so they are not behind the guest middleware.
 */
router.get('reset-password/:token', [PasswordController, 'showReset'])
router.post('reset-password/:token', [PasswordController, 'storeReset'])

router
  .group(() => {
    router.get('signup', [controllers.NewAccount, 'create'])
    router.post('signup', [controllers.NewAccount, 'store'])

    router.get('login', [controllers.Session, 'create'])
    router.post('login', [controllers.Session, 'store']).use([loginIpThrottle, loginThrottle])

    router.get('forgot-password', [PasswordController, 'showForgot'])
    router.post('forgot-password', [PasswordController, 'sendReset'])

    router.get('verify-2fa', [TwoFactorController, 'showVerify']).as('two_factor.showVerify')
    router
      .post('verify-2fa', [TwoFactorController, 'storeVerify'])
      .as('two_factor.storeVerify')
      .use(verifyTwoFactorThrottle)
  })
  .use(middleware.guest())

router
  .group(() => {
    router.get('/dashboard', [DashboardController, 'index']).as('dashboard')
    router.post('logout', [controllers.Session, 'destroy'])

    /**
     * Admin console. Every route is gated by the permission it needs, checked
     * against the signed-in user's role (superadmin always passes). Rules that
     * depend on the target — such as only superadmins touching a superadmin —
     * stay in the controllers.
     */
    const can = (opts: { all?: string[]; any?: string[] }) => middleware.permission(opts)

    router
      .group(() => {
        router.get('/', [DirectoryController, 'index']).as('directory.index')
        router.get('/directory/export', [DirectoryController, 'export']).as('directory.export')
        router.get('/directory/:id', [DirectoryController, 'show']).as('directory.show')
      })
      .use(can({ all: ['users.read'] }))

    router
      .group(() => {
        router.post('/directory/invite', [DirectoryController, 'invite']).as('directory.invite')
        router
          .post('/directory/:id/resend-invite', [DirectoryController, 'resendInvite'])
          .as('directory.resendInvite')
      })
      .use(can({ all: ['users.create'] }))

    router
      .group(() => {
        router
          .patch('/directory/:id/role', [DirectoryController, 'updateRole'])
          .as('directory.role')
        router
          .patch('/directory/:id/status', [DirectoryController, 'updateStatus'])
          .as('directory.status')
      })
      .use(can({ all: ['users.update'] }))

    router
      .delete('/directory/:id', [DirectoryController, 'destroy'])
      .as('directory.destroy')
      .use(can({ all: ['users.delete'] }))

    // Grant vs revoke is decided per request in the controller.
    router
      .patch('/directory/:id/entitlements', [DirectoryController, 'toggleEntitlement'])
      .as('directory.entitlements')
      .use(can({ any: ['entitlements.grant', 'entitlements.revoke'] }))

    router
      .group(() => {
        router
          .delete('/directory/:id/sessions', [DirectoryController, 'revokeSessions'])
          .as('directory.sessions.revokeAll')
        router
          .delete('/directory/:id/sessions/:sessionId', [DirectoryController, 'revokeSessions'])
          .as('directory.sessions.revoke')
      })
      .use(can({ all: ['sessions.revoke'] }))

    router
      .get('/apps', [AppsController, 'index'])
      .as('apps.index')
      .use(can({ all: ['apps.read', 'oauth.clients.read'] }))
    router
      .post('/apps', [AppsController, 'store'])
      .as('apps.store')
      .use(can({ all: ['apps.create', 'oauth.clients.manage'] }))
    router
      .patch('/apps/:id', [AppsController, 'update'])
      .as('apps.update')
      .use(can({ all: ['apps.update', 'oauth.clients.manage'] }))
    router
      .delete('/apps/:id', [AppsController, 'destroy'])
      .as('apps.destroy')
      .use(can({ all: ['apps.delete', 'oauth.clients.manage'] }))
    router
      .post('/apps/:id/rotate-secret', [AppsController, 'rotate'])
      .as('apps.rotateSecret')
      .use(can({ all: ['oauth.clients.manage'] }))

    // Registered before `/audit-logs/:id` so "export" is never read as an id.
    router
      .get('/audit-logs/export', [AuditLogsController, 'export'])
      .as('audit.export')
      .use(can({ all: ['audit.read', 'audit.export'] }))

    router
      .group(() => {
        router.get('/audit-logs', [AuditLogsController, 'index']).as('audit.index')
        router.get('/audit-logs/:id', [AuditLogsController, 'show']).as('audit.show')
      })
      .use(can({ all: ['audit.read'] }))

    router
      .get('/roles-access', [RolesAccessController, 'index'])
      .as('roles.index')
      .use(can({ all: ['roles.read'] }))
    router
      .post('/roles-access', [RolesAccessController, 'store'])
      .as('roles.store')
      .use(can({ all: ['roles.create'] }))
    router
      .patch('/roles-access/matrix', [RolesAccessController, 'updateMatrix'])
      .as('roles.matrix')
      .use(can({ all: ['roles.update'] }))

    router
      .get('/auth-settings', [AuthSettingsController, 'index'])
      .as('settings.index')
      .use(can({ any: ['settings.password_policy.read', 'settings.auth_methods.read'] }))
    router
      .patch('/auth-settings/policy', [AuthSettingsController, 'updatePolicy'])
      .as('settings.policy')
      .use(can({ all: ['settings.password_policy.update'] }))
    router
      .patch('/auth-settings/methods/:key', [AuthSettingsController, 'updateMethod'])
      .as('settings.method')
      .use(can({ all: ['settings.auth_methods.update'] }))

    router.get('/account-settings', [AccountSettingsController, 'index']).as('account.index')
    router
      .patch('/account-settings/profile', [AccountSettingsController, 'updateProfile'])
      .as('account.profile')
    router
      .patch('/account-settings/password', [AccountSettingsController, 'updatePassword'])
      .as('account.password')
    router
      .delete('/account-settings/sessions/:id', [AccountSettingsController, 'revokeSession'])
      .as('account.session')
    router
      .patch('/account-settings/apps/:slug', [AccountSettingsController, 'revokeApp'])
      .as('account.app')

    router.get('/setup-2fa', [TwoFactorController, 'createSetup']).as('two_factor.createSetup')
    router
      .post('/setup-2fa', [TwoFactorController, 'storeSetup'])
      .as('two_factor.storeSetup')
      .use(twoFactorManageThrottle)
    router
      .post('/setup-2fa/regenerate', [TwoFactorController, 'regenerateBackupCodes'])
      .as('two_factor.regenerate')
      .use(twoFactorManageThrottle)
    router
      .post('/setup-2fa/disable', [TwoFactorController, 'disable'])
      .as('two_factor.disable')
      .use(twoFactorManageThrottle)

    router
      .delete('/directory/:id/two-factor', [DirectoryController, 'resetTwoFactor'])
      .as('directory.twoFactor.reset')
      .use(can({ all: ['users.mfa.reset'] }))

    router.get('/consent', [ConsentController, 'show']).as('consent.show')
    router.post('/consent/approve', [ConsentController, 'approve']).as('consent.approve')
    router.post('/consent/deny', [ConsentController, 'deny']).as('consent.deny')
  })
  .use([middleware.auth(), middleware.requireTwoFactor()])
