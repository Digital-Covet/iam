import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'o_auth.authorize': { paramsTuple?: []; params?: {} }
    'o_auth.token': { paramsTuple?: []; params?: {} }
    'o_auth.revoke': { paramsTuple?: []; params?: {} }
    'o_auth.introspect': { paramsTuple?: []; params?: {} }
    'o_auth.logout': { paramsTuple?: []; params?: {} }
    'o_auth.confirm_logout': { paramsTuple?: []; params?: {} }
    'o_auth.userinfo': { paramsTuple?: []; params?: {} }
    'o_auth.jwks': { paramsTuple?: []; params?: {} }
    'o_auth.discovery': { paramsTuple?: []; params?: {} }
    'password.show_reset': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'password.store_reset': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'session.create': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'password.show_forgot': { paramsTuple?: []; params?: {} }
    'password.send_reset': { paramsTuple?: []; params?: {} }
    'two_factor.showVerify': { paramsTuple?: []; params?: {} }
    'two_factor.storeVerify': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'directory.index': { paramsTuple?: []; params?: {} }
    'directory.export': { paramsTuple?: []; params?: {} }
    'directory.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'directory.invite': { paramsTuple?: []; params?: {} }
    'directory.resendInvite': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'directory.role': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'directory.status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'directory.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'directory.entitlements': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'directory.sessions.revokeAll': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'directory.sessions.revoke': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'sessionId': ParamValue} }
    'apps.index': { paramsTuple?: []; params?: {} }
    'apps.store': { paramsTuple?: []; params?: {} }
    'apps.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'apps.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'apps.rotateSecret': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'audit.export': { paramsTuple?: []; params?: {} }
    'audit.index': { paramsTuple?: []; params?: {} }
    'audit.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.index': { paramsTuple?: []; params?: {} }
    'roles.store': { paramsTuple?: []; params?: {} }
    'roles.matrix': { paramsTuple?: []; params?: {} }
    'settings.index': { paramsTuple?: []; params?: {} }
    'settings.policy': { paramsTuple?: []; params?: {} }
    'settings.method': { paramsTuple: [ParamValue]; params: {'key': ParamValue} }
    'account.index': { paramsTuple?: []; params?: {} }
    'account.profile': { paramsTuple?: []; params?: {} }
    'account.password': { paramsTuple?: []; params?: {} }
    'account.session': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'account.app': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'two_factor.createSetup': { paramsTuple?: []; params?: {} }
    'two_factor.storeSetup': { paramsTuple?: []; params?: {} }
    'two_factor.regenerate': { paramsTuple?: []; params?: {} }
    'two_factor.disable': { paramsTuple?: []; params?: {} }
    'directory.twoFactor.reset': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'consent.show': { paramsTuple?: []; params?: {} }
    'consent.approve': { paramsTuple?: []; params?: {} }
    'consent.deny': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'o_auth.authorize': { paramsTuple?: []; params?: {} }
    'o_auth.logout': { paramsTuple?: []; params?: {} }
    'o_auth.userinfo': { paramsTuple?: []; params?: {} }
    'o_auth.jwks': { paramsTuple?: []; params?: {} }
    'o_auth.discovery': { paramsTuple?: []; params?: {} }
    'password.show_reset': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'session.create': { paramsTuple?: []; params?: {} }
    'password.show_forgot': { paramsTuple?: []; params?: {} }
    'two_factor.showVerify': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'directory.index': { paramsTuple?: []; params?: {} }
    'directory.export': { paramsTuple?: []; params?: {} }
    'directory.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'apps.index': { paramsTuple?: []; params?: {} }
    'audit.export': { paramsTuple?: []; params?: {} }
    'audit.index': { paramsTuple?: []; params?: {} }
    'audit.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.index': { paramsTuple?: []; params?: {} }
    'settings.index': { paramsTuple?: []; params?: {} }
    'account.index': { paramsTuple?: []; params?: {} }
    'two_factor.createSetup': { paramsTuple?: []; params?: {} }
    'consent.show': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'o_auth.authorize': { paramsTuple?: []; params?: {} }
    'o_auth.logout': { paramsTuple?: []; params?: {} }
    'o_auth.userinfo': { paramsTuple?: []; params?: {} }
    'o_auth.jwks': { paramsTuple?: []; params?: {} }
    'o_auth.discovery': { paramsTuple?: []; params?: {} }
    'password.show_reset': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'session.create': { paramsTuple?: []; params?: {} }
    'password.show_forgot': { paramsTuple?: []; params?: {} }
    'two_factor.showVerify': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'directory.index': { paramsTuple?: []; params?: {} }
    'directory.export': { paramsTuple?: []; params?: {} }
    'directory.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'apps.index': { paramsTuple?: []; params?: {} }
    'audit.export': { paramsTuple?: []; params?: {} }
    'audit.index': { paramsTuple?: []; params?: {} }
    'audit.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.index': { paramsTuple?: []; params?: {} }
    'settings.index': { paramsTuple?: []; params?: {} }
    'account.index': { paramsTuple?: []; params?: {} }
    'two_factor.createSetup': { paramsTuple?: []; params?: {} }
    'consent.show': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'o_auth.token': { paramsTuple?: []; params?: {} }
    'o_auth.revoke': { paramsTuple?: []; params?: {} }
    'o_auth.introspect': { paramsTuple?: []; params?: {} }
    'o_auth.confirm_logout': { paramsTuple?: []; params?: {} }
    'password.store_reset': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'session.store': { paramsTuple?: []; params?: {} }
    'password.send_reset': { paramsTuple?: []; params?: {} }
    'two_factor.storeVerify': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'directory.invite': { paramsTuple?: []; params?: {} }
    'directory.resendInvite': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'apps.store': { paramsTuple?: []; params?: {} }
    'apps.rotateSecret': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.store': { paramsTuple?: []; params?: {} }
    'two_factor.storeSetup': { paramsTuple?: []; params?: {} }
    'two_factor.regenerate': { paramsTuple?: []; params?: {} }
    'two_factor.disable': { paramsTuple?: []; params?: {} }
    'consent.approve': { paramsTuple?: []; params?: {} }
    'consent.deny': { paramsTuple?: []; params?: {} }
  }
  PATCH: {
    'directory.role': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'directory.status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'directory.entitlements': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'apps.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'roles.matrix': { paramsTuple?: []; params?: {} }
    'settings.policy': { paramsTuple?: []; params?: {} }
    'settings.method': { paramsTuple: [ParamValue]; params: {'key': ParamValue} }
    'account.profile': { paramsTuple?: []; params?: {} }
    'account.password': { paramsTuple?: []; params?: {} }
    'account.app': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
  }
  DELETE: {
    'directory.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'directory.sessions.revokeAll': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'directory.sessions.revoke': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'sessionId': ParamValue} }
    'apps.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'account.session': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'directory.twoFactor.reset': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}