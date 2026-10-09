import { createHash, randomUUID } from 'node:crypto'
import OAuthService from '#services/oauth_service'
import { signInContext } from '#services/sign_in_context'
import OAuthClient from '#models/oauth_client'
import AppEntitlement from '#models/app_entitlement'
import AuditLog from '#models/audit_log'
import { consentDecisionValidator } from '#validators/consent'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * OAuth consent (§6.4) — authorization-code grant consent screen.
 * Expressive mid-flow surface, AuthLayout wide (480px).
 *
 * Security model: every trust decision happens here. The browser only
 * carries an opaque requestId; client_id, redirect_uri, scopes, PKCE
 * challenge and state live in the server-side session pending store.
 * Approve/deny re-read that store and consume it exactly once
 * (idempotent on webview back-navigation replays).
 */
const SCOPE_REGISTRY: Record<string, { label: string; description: string }> = {
  openid: {
    label: 'Verify your identity',
    description: 'Confirm you are signed in to Digital Covet IAM',
  },
  profile: {
    label: 'See your profile',
    description: 'Name, email and avatar',
  },
  offline_access: {
    label: 'Sign you in automatically',
    description: 'Stay signed in on return visits',
  },
  entitlements: {
    label: 'Read your app access',
    description: 'Which Digital Covet apps you may open',
  },
}

type PendingRequest = {
  requestId: string
  userId: string
  clientDbId: string
  clientId: string
  redirectUri: string
  scopes: string[]
  state: string | null
  codeChallenge: string | null
  codeChallengeMethod: string | null
  nonce: string | null
}

const pendingKey = (requestId: string) => `consent_pending_${requestId}`
const consumedKey = (requestId: string) => `consent_consumed_${requestId}`

function initialsOf(name: string | null | undefined, email: string): string {
  const source = name?.trim() || email.split('@')[0]
  const parts = source.split(/[\s._-]+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

function isValidChallenge(value: string): boolean {
  return /^[A-Za-z0-9\-_~.]{43,128}$/.test(value)
}

export default class ConsentController {
  /**
   * GET /consent — validate the authorization request server-side,
   * stash it in session, render the grant card.
   */
  async show({ request, inertia, auth, session }: HttpContext) {
    const user = auth.user!
    const qs = request.qs()

    const clientId = typeof qs.client_id === 'string' ? qs.client_id.trim() : ''
    const redirectUri = typeof qs.redirect_uri === 'string' ? qs.redirect_uri.trim() : ''
    const rawScope = typeof qs.scope === 'string' ? qs.scope : 'openid profile'
    const state = typeof qs.state === 'string' ? qs.state : null
    const codeChallenge = typeof qs.code_challenge === 'string' ? qs.code_challenge.trim() : null
    const codeChallengeMethod =
      typeof qs.code_challenge_method === 'string' ? qs.code_challenge_method.trim() : null
    const nonce = typeof qs.nonce === 'string' && qs.nonce.length <= 512 ? qs.nonce : null

    const invalid = (reason: string) =>
      inertia.render('consent', { invalid: true, invalidReason: reason })

    if (!clientId || clientId.length > 128) {
      return invalid('This authorization request is no longer valid.')
    }
    if (!redirectUri || redirectUri.length > 2048) {
      return invalid('This authorization request is no longer valid.')
    }
    let parsedRedirect: URL
    try {
      parsedRedirect = new URL(redirectUri)
    } catch {
      return invalid('This authorization request is no longer valid.')
    }
    if (!['https:', 'http:'].includes(parsedRedirect.protocol)) {
      return invalid('This authorization request is no longer valid.')
    }
    if (state !== null && (state.length === 0 || state.length > 1024)) {
      return invalid('This authorization request is no longer valid.')
    }

    const client = await OAuthClient.query()
      .where('client_id', clientId)
      .whereNull('deleted_at')
      .preload('app')
      .first()

    if (!client || !client.app) {
      return invalid('This authorization request is no longer valid.')
    }
    if (client.app.deletedAt !== null || !client.app.isActive) {
      return invalid('This authorization request is no longer valid.')
    }

    // Exact-match redirect check — the open-redirect guard. No prefix,
    // substring or fallback matching.
    if (!client.redirectUris.includes(redirectUri)) {
      await AuditLog.create({
        actorId: user.id,
        action: 'oauth.consent_invalid',
        resourceType: 'oauth_client',
        resourceId: client.id,
        status: 'failure',
        ipAddress: request.ip(),
        metadata: { reason: 'redirect_uri_mismatch' },
      })
      return invalid('This authorization request is no longer valid.')
    }

    if (client.requirePkce && !codeChallenge) {
      return invalid('This authorization request is no longer valid.')
    }
    if (codeChallenge && !isValidChallenge(codeChallenge)) {
      return invalid('This authorization request is no longer valid.')
    }
    if (codeChallengeMethod !== null && !['S256', 'plain'].includes(codeChallengeMethod)) {
      return invalid('This authorization request is no longer valid.')
    }

    // Scope allowlist — unknown scopes reject the whole request instead
    // of rendering attacker-controlled text.
    const requested = rawScope.split(/\s+/).filter(Boolean)
    const scopes = [...new Set(requested)]
    if (scopes.length === 0 || scopes.length > 10) {
      return invalid('This authorization request is no longer valid.')
    }
    for (const s of scopes) {
      if (!Object.hasOwn(SCOPE_REGISTRY, s)) {
        await AuditLog.create({
          actorId: user.id,
          action: 'oauth.consent_invalid',
          resourceType: 'oauth_client',
          resourceId: client.id,
          status: 'failure',
          ipAddress: request.ip(),
          metadata: { reason: 'unknown_scope', scope: s.slice(0, 64) },
        })
        return invalid('This authorization request is no longer valid.')
      }
    }

    // Entitlement gate (Flow 1): no grant → denial card, never consent.
    const entitlement = await AppEntitlement.query()
      .where('user_id', user.id)
      .where('app_id', client.app.id)
      .where('enabled', true)
      .first()
    if (!entitlement) {
      return inertia.render('consent', {
        noAccess: true,
        appName: client.app.name,
      })
    }

    const priorGrant = await AuditLog.query()
      .where('actor_id', user.id)
      .where('action', 'oauth.consent_granted')
      .where('resource_id', client.id)
      .where('status', 'success')
      .first()

    const requestId = randomUUID()
    const pending: PendingRequest = {
      requestId,
      userId: user.id,
      clientDbId: client.id,
      clientId: client.clientId,
      redirectUri,
      scopes,
      state,
      codeChallenge,
      codeChallengeMethod,
      nonce,
    }
    session.put(pendingKey(requestId), pending)

    return inertia.render('consent', {
      requestId,
      appName: client.app.name,
      appSlug: client.app.slug.toLowerCase(),
      appDescription: client.app.description,
      redirectHost: parsedRedirect.host,
      scopes: scopes.map((key) => ({ key, ...SCOPE_REGISTRY[key] })),
      subject: {
        name: user.name,
        email: user.email,
        initials: initialsOf(user.name, user.email),
      },
      alreadyGranted: Boolean(priorGrant),
    })
  }

  /** POST /consent/approve — issue a one-time code, 302 to redirect_uri. */
  async approve({ request, auth, session, inertia }: HttpContext) {
    const user = auth.user!
    const { requestId } = await request.validateUsing(consentDecisionValidator)

    // Idempotent replay: webview back-nav re-POSTs the same requestId —
    // return the original redirect without a second code or audit row.
    const consumed = session.get(consumedKey(requestId)) as string | undefined
    if (consumed) {
      return inertia.location(consumed)
    }

    const pending = session.get(pendingKey(requestId)) as PendingRequest | undefined
    if (!pending || pending.userId !== user.id) {
      return inertia.render('consent', {
        invalid: true,
        invalidReason: 'This authorization request is no longer valid.',
      })
    }

    const signIn = signInContext(session)
    const code = await OAuthService.issueCode({
      clientDbId: pending.clientDbId,
      userId: user.id,
      redirectUri: pending.redirectUri,
      scopes: pending.scopes,
      codeChallenge: pending.codeChallenge,
      codeChallengeMethod: pending.codeChallenge ? (pending.codeChallengeMethod ?? 'plain') : null,
      nonce: pending.nonce,
      authTime: signIn?.authTime ?? null,
      amr: signIn?.amr ?? null,
    })
    const url = new URL(pending.redirectUri)
    url.searchParams.set('code', code)
    if (pending.state !== null) {
      url.searchParams.set('state', pending.state)
    }
    const target = url.toString()

    session.forget(pendingKey(requestId))
    session.put(consumedKey(requestId), target)

    await AuditLog.create({
      actorId: user.id,
      action: 'oauth.consent_granted',
      resourceType: 'oauth_client',
      resourceId: pending.clientDbId,
      status: 'success',
      ipAddress: request.ip(),
      metadata: {
        app: pending.clientId,
        scopes: pending.scopes,
        codeHash: createHash('sha256').update(code).digest('hex'),
        pkce: pending.codeChallenge !== null,
      },
    })

    return inertia.location(target)
  }

  /** POST /consent/deny — 302 with error=access_denied (RFC 6749 §4.1.2.1). */
  async deny({ request, auth, session, inertia }: HttpContext) {
    const user = auth.user!
    const { requestId } = await request.validateUsing(consentDecisionValidator)

    const consumed = session.get(consumedKey(requestId)) as string | undefined
    if (consumed) {
      return inertia.location(consumed)
    }

    const pending = session.get(pendingKey(requestId)) as PendingRequest | undefined
    if (!pending || pending.userId !== user.id) {
      return inertia.render('consent', {
        invalid: true,
        invalidReason: 'This authorization request is no longer valid.',
      })
    }

    const url = new URL(pending.redirectUri)
    url.searchParams.set('error', 'access_denied')
    url.searchParams.set('error_description', 'The user denied the authorization request.')
    if (pending.state !== null) {
      url.searchParams.set('state', pending.state)
    }
    const target = url.toString()

    session.forget(pendingKey(requestId))
    session.put(consumedKey(requestId), target)

    await AuditLog.create({
      actorId: user.id,
      action: 'oauth.consent_denied',
      resourceType: 'oauth_client',
      resourceId: pending.clientDbId,
      status: 'success',
      ipAddress: request.ip(),
      metadata: { app: pending.clientId, scopes: pending.scopes },
    })

    return inertia.location(target)
  }
}
