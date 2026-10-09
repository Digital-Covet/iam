/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'o_auth.authorize': {
    methods: ["GET","HEAD"],
    pattern: '/oauth/authorize',
    tokens: [{"old":"/oauth/authorize","type":0,"val":"oauth","end":""},{"old":"/oauth/authorize","type":0,"val":"authorize","end":""}],
    types: placeholder as Registry['o_auth.authorize']['types'],
  },
  'o_auth.token': {
    methods: ["POST"],
    pattern: '/oauth/token',
    tokens: [{"old":"/oauth/token","type":0,"val":"oauth","end":""},{"old":"/oauth/token","type":0,"val":"token","end":""}],
    types: placeholder as Registry['o_auth.token']['types'],
  },
  'o_auth.revoke': {
    methods: ["POST"],
    pattern: '/oauth/revoke',
    tokens: [{"old":"/oauth/revoke","type":0,"val":"oauth","end":""},{"old":"/oauth/revoke","type":0,"val":"revoke","end":""}],
    types: placeholder as Registry['o_auth.revoke']['types'],
  },
  'o_auth.introspect': {
    methods: ["POST"],
    pattern: '/oauth/introspect',
    tokens: [{"old":"/oauth/introspect","type":0,"val":"oauth","end":""},{"old":"/oauth/introspect","type":0,"val":"introspect","end":""}],
    types: placeholder as Registry['o_auth.introspect']['types'],
  },
  'o_auth.logout': {
    methods: ["GET","HEAD"],
    pattern: '/oauth/logout',
    tokens: [{"old":"/oauth/logout","type":0,"val":"oauth","end":""},{"old":"/oauth/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['o_auth.logout']['types'],
  },
  'o_auth.confirm_logout': {
    methods: ["POST"],
    pattern: '/oauth/logout',
    tokens: [{"old":"/oauth/logout","type":0,"val":"oauth","end":""},{"old":"/oauth/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['o_auth.confirm_logout']['types'],
  },
  'o_auth.userinfo': {
    methods: ["GET","HEAD"],
    pattern: '/oauth/userinfo',
    tokens: [{"old":"/oauth/userinfo","type":0,"val":"oauth","end":""},{"old":"/oauth/userinfo","type":0,"val":"userinfo","end":""}],
    types: placeholder as Registry['o_auth.userinfo']['types'],
  },
  'o_auth.jwks': {
    methods: ["GET","HEAD"],
    pattern: '/.well-known/jwks.json',
    tokens: [{"old":"/.well-known/jwks.json","type":0,"val":".well-known","end":""},{"old":"/.well-known/jwks.json","type":0,"val":"jwks.json","end":""}],
    types: placeholder as Registry['o_auth.jwks']['types'],
  },
  'o_auth.discovery': {
    methods: ["GET","HEAD"],
    pattern: '/.well-known/openid-configuration',
    tokens: [{"old":"/.well-known/openid-configuration","type":0,"val":".well-known","end":""},{"old":"/.well-known/openid-configuration","type":0,"val":"openid-configuration","end":""}],
    types: placeholder as Registry['o_auth.discovery']['types'],
  },
  'password.show_reset': {
    methods: ["GET","HEAD"],
    pattern: '/reset-password/:token',
    tokens: [{"old":"/reset-password/:token","type":0,"val":"reset-password","end":""},{"old":"/reset-password/:token","type":1,"val":"token","end":""}],
    types: placeholder as Registry['password.show_reset']['types'],
  },
  'password.store_reset': {
    methods: ["POST"],
    pattern: '/reset-password/:token',
    tokens: [{"old":"/reset-password/:token","type":0,"val":"reset-password","end":""},{"old":"/reset-password/:token","type":1,"val":"token","end":""}],
    types: placeholder as Registry['password.store_reset']['types'],
  },
  'session.create': {
    methods: ["GET","HEAD"],
    pattern: '/login',
    tokens: [{"old":"/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['session.create']['types'],
  },
  'session.store': {
    methods: ["POST"],
    pattern: '/login',
    tokens: [{"old":"/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['session.store']['types'],
  },
  'password.show_forgot': {
    methods: ["GET","HEAD"],
    pattern: '/forgot-password',
    tokens: [{"old":"/forgot-password","type":0,"val":"forgot-password","end":""}],
    types: placeholder as Registry['password.show_forgot']['types'],
  },
  'password.send_reset': {
    methods: ["POST"],
    pattern: '/forgot-password',
    tokens: [{"old":"/forgot-password","type":0,"val":"forgot-password","end":""}],
    types: placeholder as Registry['password.send_reset']['types'],
  },
  'two_factor.showVerify': {
    methods: ["GET","HEAD"],
    pattern: '/verify-2fa',
    tokens: [{"old":"/verify-2fa","type":0,"val":"verify-2fa","end":""}],
    types: placeholder as Registry['two_factor.showVerify']['types'],
  },
  'two_factor.storeVerify': {
    methods: ["POST"],
    pattern: '/verify-2fa',
    tokens: [{"old":"/verify-2fa","type":0,"val":"verify-2fa","end":""}],
    types: placeholder as Registry['two_factor.storeVerify']['types'],
  },
  'dashboard': {
    methods: ["GET","HEAD"],
    pattern: '/dashboard',
    tokens: [{"old":"/dashboard","type":0,"val":"dashboard","end":""}],
    types: placeholder as Registry['dashboard']['types'],
  },
  'session.destroy': {
    methods: ["POST"],
    pattern: '/logout',
    tokens: [{"old":"/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['session.destroy']['types'],
  },
  'directory.index': {
    methods: ["GET","HEAD"],
    pattern: '/',
    tokens: [{"old":"/","type":0,"val":"/","end":""}],
    types: placeholder as Registry['directory.index']['types'],
  },
  'directory.export': {
    methods: ["GET","HEAD"],
    pattern: '/directory/export',
    tokens: [{"old":"/directory/export","type":0,"val":"directory","end":""},{"old":"/directory/export","type":0,"val":"export","end":""}],
    types: placeholder as Registry['directory.export']['types'],
  },
  'directory.show': {
    methods: ["GET","HEAD"],
    pattern: '/directory/:id',
    tokens: [{"old":"/directory/:id","type":0,"val":"directory","end":""},{"old":"/directory/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['directory.show']['types'],
  },
  'directory.invite': {
    methods: ["POST"],
    pattern: '/directory/invite',
    tokens: [{"old":"/directory/invite","type":0,"val":"directory","end":""},{"old":"/directory/invite","type":0,"val":"invite","end":""}],
    types: placeholder as Registry['directory.invite']['types'],
  },
  'directory.resendInvite': {
    methods: ["POST"],
    pattern: '/directory/:id/resend-invite',
    tokens: [{"old":"/directory/:id/resend-invite","type":0,"val":"directory","end":""},{"old":"/directory/:id/resend-invite","type":1,"val":"id","end":""},{"old":"/directory/:id/resend-invite","type":0,"val":"resend-invite","end":""}],
    types: placeholder as Registry['directory.resendInvite']['types'],
  },
  'directory.role': {
    methods: ["PATCH"],
    pattern: '/directory/:id/role',
    tokens: [{"old":"/directory/:id/role","type":0,"val":"directory","end":""},{"old":"/directory/:id/role","type":1,"val":"id","end":""},{"old":"/directory/:id/role","type":0,"val":"role","end":""}],
    types: placeholder as Registry['directory.role']['types'],
  },
  'directory.status': {
    methods: ["PATCH"],
    pattern: '/directory/:id/status',
    tokens: [{"old":"/directory/:id/status","type":0,"val":"directory","end":""},{"old":"/directory/:id/status","type":1,"val":"id","end":""},{"old":"/directory/:id/status","type":0,"val":"status","end":""}],
    types: placeholder as Registry['directory.status']['types'],
  },
  'directory.destroy': {
    methods: ["DELETE"],
    pattern: '/directory/:id',
    tokens: [{"old":"/directory/:id","type":0,"val":"directory","end":""},{"old":"/directory/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['directory.destroy']['types'],
  },
  'directory.entitlements': {
    methods: ["PATCH"],
    pattern: '/directory/:id/entitlements',
    tokens: [{"old":"/directory/:id/entitlements","type":0,"val":"directory","end":""},{"old":"/directory/:id/entitlements","type":1,"val":"id","end":""},{"old":"/directory/:id/entitlements","type":0,"val":"entitlements","end":""}],
    types: placeholder as Registry['directory.entitlements']['types'],
  },
  'directory.sessions.revokeAll': {
    methods: ["DELETE"],
    pattern: '/directory/:id/sessions',
    tokens: [{"old":"/directory/:id/sessions","type":0,"val":"directory","end":""},{"old":"/directory/:id/sessions","type":1,"val":"id","end":""},{"old":"/directory/:id/sessions","type":0,"val":"sessions","end":""}],
    types: placeholder as Registry['directory.sessions.revokeAll']['types'],
  },
  'directory.sessions.revoke': {
    methods: ["DELETE"],
    pattern: '/directory/:id/sessions/:sessionId',
    tokens: [{"old":"/directory/:id/sessions/:sessionId","type":0,"val":"directory","end":""},{"old":"/directory/:id/sessions/:sessionId","type":1,"val":"id","end":""},{"old":"/directory/:id/sessions/:sessionId","type":0,"val":"sessions","end":""},{"old":"/directory/:id/sessions/:sessionId","type":1,"val":"sessionId","end":""}],
    types: placeholder as Registry['directory.sessions.revoke']['types'],
  },
  'apps.index': {
    methods: ["GET","HEAD"],
    pattern: '/apps',
    tokens: [{"old":"/apps","type":0,"val":"apps","end":""}],
    types: placeholder as Registry['apps.index']['types'],
  },
  'apps.store': {
    methods: ["POST"],
    pattern: '/apps',
    tokens: [{"old":"/apps","type":0,"val":"apps","end":""}],
    types: placeholder as Registry['apps.store']['types'],
  },
  'apps.update': {
    methods: ["PATCH"],
    pattern: '/apps/:id',
    tokens: [{"old":"/apps/:id","type":0,"val":"apps","end":""},{"old":"/apps/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['apps.update']['types'],
  },
  'apps.destroy': {
    methods: ["DELETE"],
    pattern: '/apps/:id',
    tokens: [{"old":"/apps/:id","type":0,"val":"apps","end":""},{"old":"/apps/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['apps.destroy']['types'],
  },
  'apps.rotateSecret': {
    methods: ["POST"],
    pattern: '/apps/:id/rotate-secret',
    tokens: [{"old":"/apps/:id/rotate-secret","type":0,"val":"apps","end":""},{"old":"/apps/:id/rotate-secret","type":1,"val":"id","end":""},{"old":"/apps/:id/rotate-secret","type":0,"val":"rotate-secret","end":""}],
    types: placeholder as Registry['apps.rotateSecret']['types'],
  },
  'audit.export': {
    methods: ["GET","HEAD"],
    pattern: '/audit-logs/export',
    tokens: [{"old":"/audit-logs/export","type":0,"val":"audit-logs","end":""},{"old":"/audit-logs/export","type":0,"val":"export","end":""}],
    types: placeholder as Registry['audit.export']['types'],
  },
  'audit.index': {
    methods: ["GET","HEAD"],
    pattern: '/audit-logs',
    tokens: [{"old":"/audit-logs","type":0,"val":"audit-logs","end":""}],
    types: placeholder as Registry['audit.index']['types'],
  },
  'audit.show': {
    methods: ["GET","HEAD"],
    pattern: '/audit-logs/:id',
    tokens: [{"old":"/audit-logs/:id","type":0,"val":"audit-logs","end":""},{"old":"/audit-logs/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['audit.show']['types'],
  },
  'roles.index': {
    methods: ["GET","HEAD"],
    pattern: '/roles-access',
    tokens: [{"old":"/roles-access","type":0,"val":"roles-access","end":""}],
    types: placeholder as Registry['roles.index']['types'],
  },
  'roles.store': {
    methods: ["POST"],
    pattern: '/roles-access',
    tokens: [{"old":"/roles-access","type":0,"val":"roles-access","end":""}],
    types: placeholder as Registry['roles.store']['types'],
  },
  'roles.matrix': {
    methods: ["PATCH"],
    pattern: '/roles-access/matrix',
    tokens: [{"old":"/roles-access/matrix","type":0,"val":"roles-access","end":""},{"old":"/roles-access/matrix","type":0,"val":"matrix","end":""}],
    types: placeholder as Registry['roles.matrix']['types'],
  },
  'settings.index': {
    methods: ["GET","HEAD"],
    pattern: '/auth-settings',
    tokens: [{"old":"/auth-settings","type":0,"val":"auth-settings","end":""}],
    types: placeholder as Registry['settings.index']['types'],
  },
  'settings.policy': {
    methods: ["PATCH"],
    pattern: '/auth-settings/policy',
    tokens: [{"old":"/auth-settings/policy","type":0,"val":"auth-settings","end":""},{"old":"/auth-settings/policy","type":0,"val":"policy","end":""}],
    types: placeholder as Registry['settings.policy']['types'],
  },
  'settings.method': {
    methods: ["PATCH"],
    pattern: '/auth-settings/methods/:key',
    tokens: [{"old":"/auth-settings/methods/:key","type":0,"val":"auth-settings","end":""},{"old":"/auth-settings/methods/:key","type":0,"val":"methods","end":""},{"old":"/auth-settings/methods/:key","type":1,"val":"key","end":""}],
    types: placeholder as Registry['settings.method']['types'],
  },
  'account.index': {
    methods: ["GET","HEAD"],
    pattern: '/account-settings',
    tokens: [{"old":"/account-settings","type":0,"val":"account-settings","end":""}],
    types: placeholder as Registry['account.index']['types'],
  },
  'account.profile': {
    methods: ["PATCH"],
    pattern: '/account-settings/profile',
    tokens: [{"old":"/account-settings/profile","type":0,"val":"account-settings","end":""},{"old":"/account-settings/profile","type":0,"val":"profile","end":""}],
    types: placeholder as Registry['account.profile']['types'],
  },
  'account.password': {
    methods: ["PATCH"],
    pattern: '/account-settings/password',
    tokens: [{"old":"/account-settings/password","type":0,"val":"account-settings","end":""},{"old":"/account-settings/password","type":0,"val":"password","end":""}],
    types: placeholder as Registry['account.password']['types'],
  },
  'account.session': {
    methods: ["DELETE"],
    pattern: '/account-settings/sessions/:id',
    tokens: [{"old":"/account-settings/sessions/:id","type":0,"val":"account-settings","end":""},{"old":"/account-settings/sessions/:id","type":0,"val":"sessions","end":""},{"old":"/account-settings/sessions/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['account.session']['types'],
  },
  'account.app': {
    methods: ["PATCH"],
    pattern: '/account-settings/apps/:slug',
    tokens: [{"old":"/account-settings/apps/:slug","type":0,"val":"account-settings","end":""},{"old":"/account-settings/apps/:slug","type":0,"val":"apps","end":""},{"old":"/account-settings/apps/:slug","type":1,"val":"slug","end":""}],
    types: placeholder as Registry['account.app']['types'],
  },
  'two_factor.createSetup': {
    methods: ["GET","HEAD"],
    pattern: '/setup-2fa',
    tokens: [{"old":"/setup-2fa","type":0,"val":"setup-2fa","end":""}],
    types: placeholder as Registry['two_factor.createSetup']['types'],
  },
  'two_factor.storeSetup': {
    methods: ["POST"],
    pattern: '/setup-2fa',
    tokens: [{"old":"/setup-2fa","type":0,"val":"setup-2fa","end":""}],
    types: placeholder as Registry['two_factor.storeSetup']['types'],
  },
  'two_factor.regenerate': {
    methods: ["POST"],
    pattern: '/setup-2fa/regenerate',
    tokens: [{"old":"/setup-2fa/regenerate","type":0,"val":"setup-2fa","end":""},{"old":"/setup-2fa/regenerate","type":0,"val":"regenerate","end":""}],
    types: placeholder as Registry['two_factor.regenerate']['types'],
  },
  'two_factor.disable': {
    methods: ["POST"],
    pattern: '/setup-2fa/disable',
    tokens: [{"old":"/setup-2fa/disable","type":0,"val":"setup-2fa","end":""},{"old":"/setup-2fa/disable","type":0,"val":"disable","end":""}],
    types: placeholder as Registry['two_factor.disable']['types'],
  },
  'directory.twoFactor.reset': {
    methods: ["DELETE"],
    pattern: '/directory/:id/two-factor',
    tokens: [{"old":"/directory/:id/two-factor","type":0,"val":"directory","end":""},{"old":"/directory/:id/two-factor","type":1,"val":"id","end":""},{"old":"/directory/:id/two-factor","type":0,"val":"two-factor","end":""}],
    types: placeholder as Registry['directory.twoFactor.reset']['types'],
  },
  'consent.show': {
    methods: ["GET","HEAD"],
    pattern: '/consent',
    tokens: [{"old":"/consent","type":0,"val":"consent","end":""}],
    types: placeholder as Registry['consent.show']['types'],
  },
  'consent.approve': {
    methods: ["POST"],
    pattern: '/consent/approve',
    tokens: [{"old":"/consent/approve","type":0,"val":"consent","end":""},{"old":"/consent/approve","type":0,"val":"approve","end":""}],
    types: placeholder as Registry['consent.approve']['types'],
  },
  'consent.deny': {
    methods: ["POST"],
    pattern: '/consent/deny',
    tokens: [{"old":"/consent/deny","type":0,"val":"consent","end":""},{"old":"/consent/deny","type":0,"val":"deny","end":""}],
    types: placeholder as Registry['consent.deny']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
