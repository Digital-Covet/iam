/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'o_auth.authorize': {
    methods: ["GET","HEAD"]
    pattern: '/oauth/authorize'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/oauth_controller').default['authorize']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/oauth_controller').default['authorize']>>>
    }
  }
  'o_auth.token': {
    methods: ["POST"]
    pattern: '/oauth/token'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/oauth_controller').default['token']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/oauth_controller').default['token']>>>
    }
  }
  'o_auth.revoke': {
    methods: ["POST"]
    pattern: '/oauth/revoke'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/oauth_controller').default['revoke']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/oauth_controller').default['revoke']>>>
    }
  }
  'o_auth.introspect': {
    methods: ["POST"]
    pattern: '/oauth/introspect'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/oauth_controller').default['introspect']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/oauth_controller').default['introspect']>>>
    }
  }
  'o_auth.logout': {
    methods: ["GET","HEAD"]
    pattern: '/oauth/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/oauth_controller').default['logout']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/oauth_controller').default['logout']>>>
    }
  }
  'o_auth.confirm_logout': {
    methods: ["POST"]
    pattern: '/oauth/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/oauth_controller').default['confirmLogout']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/oauth_controller').default['confirmLogout']>>>
    }
  }
  'o_auth.userinfo': {
    methods: ["GET","HEAD"]
    pattern: '/oauth/userinfo'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/oauth_controller').default['userinfo']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/oauth_controller').default['userinfo']>>>
    }
  }
  'o_auth.jwks': {
    methods: ["GET","HEAD"]
    pattern: '/.well-known/jwks.json'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/oauth_controller').default['jwks']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/oauth_controller').default['jwks']>>>
    }
  }
  'o_auth.discovery': {
    methods: ["GET","HEAD"]
    pattern: '/.well-known/openid-configuration'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/oauth_controller').default['discovery']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/oauth_controller').default['discovery']>>>
    }
  }
  'password.show_reset': {
    methods: ["GET","HEAD"]
    pattern: '/reset-password/:token'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { token: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/password_controller').default['showReset']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/password_controller').default['showReset']>>>
    }
  }
  'password.store_reset': {
    methods: ["POST"]
    pattern: '/reset-password/:token'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { token: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/password_controller').default['storeReset']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/password_controller').default['storeReset']>>>
    }
  }
  'session.create': {
    methods: ["GET","HEAD"]
    pattern: '/login'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/session_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/session_controller').default['create']>>>
    }
  }
  'session.store': {
    methods: ["POST"]
    pattern: '/login'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').loginValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').loginValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/session_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/session_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'password.show_forgot': {
    methods: ["GET","HEAD"]
    pattern: '/forgot-password'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/password_controller').default['showForgot']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/password_controller').default['showForgot']>>>
    }
  }
  'password.send_reset': {
    methods: ["POST"]
    pattern: '/forgot-password'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/password_controller').default['sendReset']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/password_controller').default['sendReset']>>>
    }
  }
  'two_factor.showVerify': {
    methods: ["GET","HEAD"]
    pattern: '/verify-2fa'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/two_factor_controller').default['showVerify']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/two_factor_controller').default['showVerify']>>>
    }
  }
  'two_factor.storeVerify': {
    methods: ["POST"]
    pattern: '/verify-2fa'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/two_factor').verifyBackupCodeValidator)>|InferInput<(typeof import('#validators/two_factor').verifyTotpValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/two_factor').verifyBackupCodeValidator)>|InferInput<(typeof import('#validators/two_factor').verifyTotpValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/two_factor_controller').default['storeVerify']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/two_factor_controller').default['storeVerify']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'dashboard': {
    methods: ["GET","HEAD"]
    pattern: '/dashboard'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/dashboard_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/dashboard_controller').default['index']>>>
    }
  }
  'session.destroy': {
    methods: ["POST"]
    pattern: '/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/session_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/session_controller').default['destroy']>>>
    }
  }
  'directory.index': {
    methods: ["GET","HEAD"]
    pattern: '/'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/directory_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/directory_controller').default['index']>>>
    }
  }
  'directory.export': {
    methods: ["GET","HEAD"]
    pattern: '/directory/export'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/directory_controller').default['export']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/directory_controller').default['export']>>>
    }
  }
  'directory.show': {
    methods: ["GET","HEAD"]
    pattern: '/directory/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/directory_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/directory_controller').default['show']>>>
    }
  }
  'directory.invite': {
    methods: ["POST"]
    pattern: '/directory/invite'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/directory_controller').default['invite']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/directory_controller').default['invite']>>>
    }
  }
  'directory.resendInvite': {
    methods: ["POST"]
    pattern: '/directory/:id/resend-invite'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/directory_controller').default['resendInvite']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/directory_controller').default['resendInvite']>>>
    }
  }
  'directory.role': {
    methods: ["PATCH"]
    pattern: '/directory/:id/role'
    types: {
      body: ExtractBody<InferInput<(typeof import('@vinejs/vine').default)['create']>|InferInput<(typeof import('@vinejs/vine').default)['string()']['trim()']['minLength(2)']['maxLength']>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('@vinejs/vine').default)['create']>|InferInput<(typeof import('@vinejs/vine').default)['string()']['trim()']['minLength(2)']['maxLength']>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/directory_controller').default['updateRole']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/directory_controller').default['updateRole']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'directory.status': {
    methods: ["PATCH"]
    pattern: '/directory/:id/status'
    types: {
      body: ExtractBody<InferInput<(typeof import('@vinejs/vine').default)['create']>|InferInput<(typeof import('@vinejs/vine').default)['enum']>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('@vinejs/vine').default)['create']>|InferInput<(typeof import('@vinejs/vine').default)['enum']>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/directory_controller').default['updateStatus']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/directory_controller').default['updateStatus']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'directory.destroy': {
    methods: ["DELETE"]
    pattern: '/directory/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/directory_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/directory_controller').default['destroy']>>>
    }
  }
  'directory.entitlements': {
    methods: ["PATCH"]
    pattern: '/directory/:id/entitlements'
    types: {
      body: ExtractBody<InferInput<(typeof import('@vinejs/vine').default)['create']>|InferInput<(typeof import('@vinejs/vine').default)['enum']>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('@vinejs/vine').default)['create']>|InferInput<(typeof import('@vinejs/vine').default)['enum']>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/directory_controller').default['toggleEntitlement']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/directory_controller').default['toggleEntitlement']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'directory.sessions.revokeAll': {
    methods: ["DELETE"]
    pattern: '/directory/:id/sessions'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/directory_controller').default['revokeSessions']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/directory_controller').default['revokeSessions']>>>
    }
  }
  'directory.sessions.revoke': {
    methods: ["DELETE"]
    pattern: '/directory/:id/sessions/:sessionId'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; sessionId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/directory_controller').default['revokeSessions']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/directory_controller').default['revokeSessions']>>>
    }
  }
  'apps.index': {
    methods: ["GET","HEAD"]
    pattern: '/apps'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/apps_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/apps_controller').default['index']>>>
    }
  }
  'apps.store': {
    methods: ["POST"]
    pattern: '/apps'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/apps_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/apps_controller').default['store']>>>
    }
  }
  'apps.update': {
    methods: ["PATCH"]
    pattern: '/apps/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/apps_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/apps_controller').default['update']>>>
    }
  }
  'apps.destroy': {
    methods: ["DELETE"]
    pattern: '/apps/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/apps_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/apps_controller').default['destroy']>>>
    }
  }
  'apps.rotateSecret': {
    methods: ["POST"]
    pattern: '/apps/:id/rotate-secret'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/apps_controller').default['rotate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/apps_controller').default['rotate']>>>
    }
  }
  'audit.export': {
    methods: ["GET","HEAD"]
    pattern: '/audit-logs/export'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/audit_logs_controller').default['export']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/audit_logs_controller').default['export']>>>
    }
  }
  'audit.index': {
    methods: ["GET","HEAD"]
    pattern: '/audit-logs'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/audit_logs_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/audit_logs_controller').default['index']>>>
    }
  }
  'audit.show': {
    methods: ["GET","HEAD"]
    pattern: '/audit-logs/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/audit_logs_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/audit_logs_controller').default['show']>>>
    }
  }
  'roles.index': {
    methods: ["GET","HEAD"]
    pattern: '/roles-access'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/roles_access_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/roles_access_controller').default['index']>>>
    }
  }
  'roles.store': {
    methods: ["POST"]
    pattern: '/roles-access'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/roles_access_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/roles_access_controller').default['store']>>>
    }
  }
  'roles.matrix': {
    methods: ["PATCH"]
    pattern: '/roles-access/matrix'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/roles_access_controller').default['updateMatrix']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/roles_access_controller').default['updateMatrix']>>>
    }
  }
  'settings.index': {
    methods: ["GET","HEAD"]
    pattern: '/auth-settings'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth_settings_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth_settings_controller').default['index']>>>
    }
  }
  'settings.policy': {
    methods: ["PATCH"]
    pattern: '/auth-settings/policy'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/auth_settings').policyValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/auth_settings').policyValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth_settings_controller').default['updatePolicy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth_settings_controller').default['updatePolicy']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'settings.method': {
    methods: ["PATCH"]
    pattern: '/auth-settings/methods/:key'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/auth_settings').methodValidator)>>
      paramsTuple: [ParamValue]
      params: { key: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/auth_settings').methodValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth_settings_controller').default['updateMethod']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth_settings_controller').default['updateMethod']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'account.index': {
    methods: ["GET","HEAD"]
    pattern: '/account-settings'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/account_settings_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/account_settings_controller').default['index']>>>
    }
  }
  'account.profile': {
    methods: ["PATCH"]
    pattern: '/account-settings/profile'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/account_settings').profileValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/account_settings').profileValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/account_settings_controller').default['updateProfile']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/account_settings_controller').default['updateProfile']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'account.password': {
    methods: ["PATCH"]
    pattern: '/account-settings/password'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/account_settings').passwordValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/account_settings').passwordValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/account_settings_controller').default['updatePassword']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/account_settings_controller').default['updatePassword']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'account.session': {
    methods: ["DELETE"]
    pattern: '/account-settings/sessions/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/account_settings_controller').default['revokeSession']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/account_settings_controller').default['revokeSession']>>>
    }
  }
  'account.app': {
    methods: ["PATCH"]
    pattern: '/account-settings/apps/:slug'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/account_settings').revokeAppValidator)>>
      paramsTuple: [ParamValue]
      params: { slug: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/account_settings').revokeAppValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/account_settings_controller').default['revokeApp']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/account_settings_controller').default['revokeApp']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'two_factor.createSetup': {
    methods: ["GET","HEAD"]
    pattern: '/setup-2fa'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/two_factor_controller').default['createSetup']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/two_factor_controller').default['createSetup']>>>
    }
  }
  'two_factor.storeSetup': {
    methods: ["POST"]
    pattern: '/setup-2fa'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/two_factor').setupConfirmValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/two_factor').setupConfirmValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/two_factor_controller').default['storeSetup']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/two_factor_controller').default['storeSetup']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'two_factor.regenerate': {
    methods: ["POST"]
    pattern: '/setup-2fa/regenerate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/two_factor').regenerateValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/two_factor').regenerateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/two_factor_controller').default['regenerateBackupCodes']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/two_factor_controller').default['regenerateBackupCodes']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'two_factor.disable': {
    methods: ["POST"]
    pattern: '/setup-2fa/disable'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/two_factor').disableValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/two_factor').disableValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/two_factor_controller').default['disable']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/two_factor_controller').default['disable']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'directory.twoFactor.reset': {
    methods: ["DELETE"]
    pattern: '/directory/:id/two-factor'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/directory_controller').default['resetTwoFactor']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/directory_controller').default['resetTwoFactor']>>>
    }
  }
  'consent.show': {
    methods: ["GET","HEAD"]
    pattern: '/consent'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/consent_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/consent_controller').default['show']>>>
    }
  }
  'consent.approve': {
    methods: ["POST"]
    pattern: '/consent/approve'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/consent').consentDecisionValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/consent').consentDecisionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/consent_controller').default['approve']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/consent_controller').default['approve']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'consent.deny': {
    methods: ["POST"]
    pattern: '/consent/deny'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/consent').consentDecisionValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/consent').consentDecisionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/consent_controller').default['deny']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/consent_controller').default['deny']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
}
