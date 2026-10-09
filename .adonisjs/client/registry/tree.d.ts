/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  oAuth: {
    authorize: typeof routes['o_auth.authorize']
    token: typeof routes['o_auth.token']
    revoke: typeof routes['o_auth.revoke']
    introspect: typeof routes['o_auth.introspect']
    logout: typeof routes['o_auth.logout']
    confirmLogout: typeof routes['o_auth.confirm_logout']
    userinfo: typeof routes['o_auth.userinfo']
    jwks: typeof routes['o_auth.jwks']
    discovery: typeof routes['o_auth.discovery']
  }
  password: {
    showReset: typeof routes['password.show_reset']
    storeReset: typeof routes['password.store_reset']
    showForgot: typeof routes['password.show_forgot']
    sendReset: typeof routes['password.send_reset']
  }
  session: {
    create: typeof routes['session.create']
    store: typeof routes['session.store']
    destroy: typeof routes['session.destroy']
  }
  twoFactor: {
    showVerify: typeof routes['two_factor.showVerify']
    storeVerify: typeof routes['two_factor.storeVerify']
    createSetup: typeof routes['two_factor.createSetup']
    storeSetup: typeof routes['two_factor.storeSetup']
    regenerate: typeof routes['two_factor.regenerate']
    disable: typeof routes['two_factor.disable']
  }
  dashboard: typeof routes['dashboard']
  directory: {
    index: typeof routes['directory.index']
    export: typeof routes['directory.export']
    show: typeof routes['directory.show']
    invite: typeof routes['directory.invite']
    resendInvite: typeof routes['directory.resendInvite']
    role: typeof routes['directory.role']
    status: typeof routes['directory.status']
    destroy: typeof routes['directory.destroy']
    entitlements: typeof routes['directory.entitlements']
    sessions: {
      revokeAll: typeof routes['directory.sessions.revokeAll']
      revoke: typeof routes['directory.sessions.revoke']
    }
    twoFactor: {
      reset: typeof routes['directory.twoFactor.reset']
    }
  }
  apps: {
    index: typeof routes['apps.index']
    store: typeof routes['apps.store']
    update: typeof routes['apps.update']
    destroy: typeof routes['apps.destroy']
    rotateSecret: typeof routes['apps.rotateSecret']
  }
  audit: {
    export: typeof routes['audit.export']
    index: typeof routes['audit.index']
    show: typeof routes['audit.show']
  }
  roles: {
    index: typeof routes['roles.index']
    store: typeof routes['roles.store']
    matrix: typeof routes['roles.matrix']
  }
  settings: {
    index: typeof routes['settings.index']
    policy: typeof routes['settings.policy']
    method: typeof routes['settings.method']
  }
  account: {
    index: typeof routes['account.index']
    profile: typeof routes['account.profile']
    password: typeof routes['account.password']
    session: typeof routes['account.session']
    app: typeof routes['account.app']
  }
  consent: {
    show: typeof routes['consent.show']
    approve: typeof routes['consent.approve']
    deny: typeof routes['consent.deny']
  }
}
