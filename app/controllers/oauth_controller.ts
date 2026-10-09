import AuditLog from '#models/audit_log'
import OAuthClient from '#models/oauth_client'
import User from '#models/user'
import OAuthService, { OAuthError, issuer } from '#services/oauth_service'
import SessionTracker from '#services/session_tracker'
import type { HttpContext } from '@adonisjs/core/http'

const SCOPES = ['openid', 'profile', 'offline_access', 'entitlements', 'roles']

const LOGOUT_PENDING_KEY = 'oauth_logout_pending'

type LogoutRequest = {
  client: OAuthClient | null
  hint: Record<string, any> | null
  redirect: string | null
  state: string | null
}

/** A validated logout request waiting for the user's confirmation. */
type PendingLogout = { redirect: string | null; state: string | null; clientId: string | null }

/**
 * OAuth 2.0 / OpenID Connect provider endpoints. Authorization-code grant
 * with PKCE; the interactive step lives in ConsentController.
 */
export default class OAuthController {
  /**
   * GET /oauth/authorize — entry point for client apps. Signed-out users are
   * sent to /login and returned here afterwards; everything else (client,
   * redirect_uri, scope and PKCE validation, entitlement gate) is enforced
   * by the consent step, so unknown redirect URIs are never followed.
   */
  async authorize({ request, response, auth, session }: HttpContext) {
    const qs = request.qs()
    if (qs.response_type !== 'code') {
      return response.badRequest({
        error: 'unsupported_response_type',
        error_description: 'Only response_type=code is supported.',
      })
    }

    const query = new URLSearchParams()
    for (const [k, v] of Object.entries(qs)) {
      if (typeof v === 'string') query.set(k, v)
    }
    const consentUrl = `/consent?${query.toString()}`

    if (!(await auth.check())) {
      session.put('intended_url', `/oauth/authorize?${query.toString()}`)
      return response.redirect('/login')
    }
    const { twoFactorRequired } = await import('#services/two_factor_policy')
    if (await twoFactorRequired()) {
      await auth.user!.load('twoFactor').catch(() => {})
      if (!auth.user!.twoFactor?.enabled) {
        session.put('intended_url', `/oauth/authorize?${query.toString()}`)
        session.flash('error', 'Set up two-factor before continuing to the app.')
        return response.redirect().toRoute('two_factor.createSetup')
      }
    }
    return response.redirect(consentUrl)
  }

  /** POST /oauth/token — authorization_code grant. */
  async token({ request, response }: HttpContext) {
    response.header('Cache-Control', 'no-store')
    response.header('Pragma', 'no-cache')
    try {
      const body = request.all()
      if (body.grant_type !== 'authorization_code' && body.grant_type !== 'refresh_token') {
        throw new OAuthError(
          'unsupported_grant_type',
          'Only authorization_code and refresh_token are supported.'
        )
      }
      const client = await OAuthService.authenticateClient(request.header('authorization'), body)

      if (body.grant_type === 'refresh_token') {
        if (typeof body.refresh_token !== 'string' || body.refresh_token === '') {
          throw new OAuthError('invalid_request', 'refresh_token is required.')
        }
        return response.ok(
          await OAuthService.refresh(client, {
            refreshToken: body.refresh_token,
            scope: typeof body.scope === 'string' ? body.scope : null,
            ip: request.ip(),
          })
        )
      }

      if (typeof body.code !== 'string' || typeof body.redirect_uri !== 'string') {
        throw new OAuthError('invalid_request', 'code and redirect_uri are required.')
      }
      const result = await OAuthService.exchangeCode(client, {
        code: body.code,
        redirectUri: body.redirect_uri,
        codeVerifier: typeof body.code_verifier === 'string' ? body.code_verifier : null,
      })
      return response.ok(result)
    } catch (error) {
      return this.fail(response, error)
    }
  }

  /**
   * POST /oauth/revoke — RFC 7009. Revoking either token of a grant ends the
   * whole grant. Answers 200 even for unknown tokens so it can't be probed.
   */
  async revoke({ request, response }: HttpContext) {
    response.header('Cache-Control', 'no-store')
    try {
      const body = request.all()
      const client = await OAuthService.authenticateClient(request.header('authorization'), body)
      if (typeof body.token !== 'string' || body.token === '') {
        throw new OAuthError('invalid_request', 'token is required.')
      }
      const grantId = await OAuthService.revokeToken(client, body.token)
      if (grantId) {
        await AuditLog.create({
          actorId: null,
          action: 'oauth.grant_revoked',
          resourceType: 'oauth_client',
          resourceId: client.id,
          status: 'success',
          ipAddress: request.ip(),
          metadata: { app: client.clientId, grantId, by: 'client' },
        })
      }
      return response.ok({})
    } catch (error) {
      return this.fail(response, error)
    }
  }

  /** POST /oauth/introspect — RFC 7662, for the client that holds the token. */
  async introspect({ request, response }: HttpContext) {
    response.header('Cache-Control', 'no-store')
    try {
      const body = request.all()
      const client = await OAuthService.authenticateClient(request.header('authorization'), body)
      if (typeof body.token !== 'string' || body.token === '') {
        throw new OAuthError('invalid_request', 'token is required.')
      }
      return response.ok(await OAuthService.introspect(client, body.token))
    } catch (error) {
      return this.fail(response, error)
    }
  }

  /** GET /oauth/userinfo — Bearer access token. */
  async userinfo({ request, response }: HttpContext) {
    response.header('Cache-Control', 'no-store')
    try {
      const header = request.header('authorization') ?? ''
      const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
      const claims = token ? OAuthService.verify(token) : null
      if (!claims || claims.token_use !== 'access') {
        response.header('WWW-Authenticate', 'Bearer error="invalid_token"')
        return response.unauthorized({ error: 'invalid_token' })
      }
      if (!(await OAuthService.activeGrant(claims))) {
        response.header('WWW-Authenticate', 'Bearer error="invalid_token"')
        return response.unauthorized({ error: 'invalid_token' })
      }
      const user = await User.query()
        .where('id', claims.sub)
        .whereNull('deleted_at')
        .whereNull('banned_at')
        .first()
      if (!user) {
        response.header('WWW-Authenticate', 'Bearer error="invalid_token"')
        return response.unauthorized({ error: 'invalid_token' })
      }
      const scopes = String(claims.scope ?? '').split(' ')
      return response.ok({ sub: user.id, ...(await OAuthService.userClaims(user, scopes)) })
    } catch (error) {
      return this.fail(response, error)
    }
  }

  /**
   * GET /oauth/logout — OpenID Connect RP-Initiated Logout 1.0.
   *
   * An `id_token_hint` issued by this server proves the request comes from the
   * app, so the matching signed-in user is signed out straight away. Without
   * one, any site could sign people out with a link, so the user is asked to
   * confirm first. `post_logout_redirect_uri` is only ever followed when it
   * exactly matches one registered on the client.
   */
  async logout(ctx: HttpContext) {
    const { request, inertia, auth, session } = ctx

    let resolved: LogoutRequest
    try {
      resolved = await this.resolveLogout(request.qs())
    } catch (error) {
      return this.logoutInvalid(ctx, error)
    }

    if (!(await auth.check())) {
      return this.finishLogout(ctx, resolved.redirect, resolved.state)
    }
    const user = auth.user!

    if (resolved.hint) {
      // A hint for a different user is not a request to end this session.
      if (resolved.hint.sub === user.id) await this.endSession(ctx, user.id, resolved.client)
      return this.finishLogout(ctx, resolved.redirect, resolved.state)
    }

    session.put(LOGOUT_PENDING_KEY, {
      redirect: resolved.redirect,
      state: resolved.state,
      clientId: resolved.client?.clientId ?? null,
    } satisfies PendingLogout)
    return inertia.render('auth/logout_confirm', {
      appName: resolved.client?.app?.name ?? null,
      email: user.email,
    })
  }

  /** POST /oauth/logout — the user confirmed on the confirmation page. */
  async confirmLogout(ctx: HttpContext) {
    const { auth, session } = ctx
    // Read before signing out: logging out starts a fresh session.
    const pending = session.get(LOGOUT_PENDING_KEY) as PendingLogout | undefined
    session.forget(LOGOUT_PENDING_KEY)

    if (auth.user) {
      const client = pending?.clientId
        ? await OAuthClient.query().where('client_id', pending.clientId).first()
        : null
      await this.endSession(ctx, auth.user.id, client)
    }
    return this.finishLogout(ctx, pending?.redirect ?? null, pending?.state ?? null)
  }

  jwks({ response }: HttpContext) {
    try {
      response.header('Cache-Control', 'public, max-age=300')
      return response.ok(OAuthService.jwks())
    } catch (error) {
      return this.fail(response, error)
    }
  }

  discovery({ response }: HttpContext) {
    const iss = issuer()
    response.header('Cache-Control', 'public, max-age=300')
    return response.ok({
      issuer: iss,
      authorization_endpoint: `${iss}/oauth/authorize`,
      token_endpoint: `${iss}/oauth/token`,
      userinfo_endpoint: `${iss}/oauth/userinfo`,
      end_session_endpoint: `${iss}/oauth/logout`,
      jwks_uri: `${iss}/.well-known/jwks.json`,
      response_types_supported: ['code'],
      revocation_endpoint: `${iss}/oauth/revoke`,
      introspection_endpoint: `${iss}/oauth/introspect`,
      revocation_endpoint_auth_methods_supported: [
        'client_secret_basic',
        'client_secret_post',
        'none',
      ],
      introspection_endpoint_auth_methods_supported: [
        'client_secret_basic',
        'client_secret_post',
        'none',
      ],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      scopes_supported: SCOPES,
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
      code_challenge_methods_supported: ['S256', 'plain'],
      claims_supported: [
        'sub',
        'name',
        'email',
        'email_verified',
        'picture',
        'app_access',
        'role',
        'auth_time',
        'amr',
      ],
      amr_values_supported: ['pwd', 'otp', 'mfa'],
    })
  }

  /** Validate the logout parameters; throws OAuthError on anything untrustworthy. */
  private async resolveLogout(qs: Record<string, unknown>): Promise<LogoutRequest> {
    const text = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)

    const hintRaw = text(qs.id_token_hint)
    let hint: Record<string, any> | null = null
    if (hintRaw) {
      hint = OAuthService.verify(hintRaw, { allowExpired: true })
      if (!hint || hint.token_use !== 'id') {
        throw new OAuthError(
          'invalid_request',
          'id_token_hint is not an ID token issued by this server.'
        )
      }
    }

    const audience = typeof hint?.aud === 'string' ? hint.aud : null
    const clientIdParam = text(qs.client_id)
    if (audience && clientIdParam && audience !== clientIdParam) {
      throw new OAuthError('invalid_request', 'client_id does not match id_token_hint.')
    }

    const clientId = audience ?? clientIdParam
    let client: OAuthClient | null = null
    if (clientId) {
      client = await OAuthClient.query()
        .where('client_id', clientId)
        .whereNull('deleted_at')
        .preload('app')
        .first()
      if (!client || client.app?.deletedAt) {
        throw new OAuthError('invalid_request', 'Unknown client.')
      }
    }

    const redirectParam = text(qs.post_logout_redirect_uri)
    let redirect: string | null = null
    if (redirectParam) {
      if (!client || !client.postLogoutRedirectUris.includes(redirectParam)) {
        throw new OAuthError(
          'invalid_request',
          'post_logout_redirect_uri is not registered for this client.'
        )
      }
      redirect = redirectParam
    }

    return { client, hint, redirect, state: redirect ? text(qs.state) : null }
  }

  private async endSession(ctx: HttpContext, userId: string, client: OAuthClient | null) {
    await SessionTracker.recordLogout(ctx, userId, {
      via: 'oauth',
      client: client?.clientId ?? null,
    })
    await ctx.auth.use('web').logout()
  }

  private finishLogout(ctx: HttpContext, redirect: string | null, state: string | null) {
    if (!redirect) {
      ctx.session.flash('success', 'You are signed out.')
      return ctx.response.redirect('/login')
    }
    const url = new URL(redirect)
    if (state) url.searchParams.set('state', state)
    return ctx.response.redirect(url.toString())
  }

  private logoutInvalid(ctx: HttpContext, error: unknown) {
    if (!(error instanceof OAuthError)) throw error
    ctx.response.status(400)
    return ctx.inertia.render('auth/logout_confirm', { invalid: true, reason: error.description })
  }

  private fail(response: HttpContext['response'], error: unknown) {
    if (error instanceof OAuthError) {
      if (error.status === 401) response.header('WWW-Authenticate', 'Basic realm="oauth"')
      return response
        .status(error.status)
        .send({ error: error.code, error_description: error.description })
    }
    throw error
  }
}
