import {
  createHash,
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  randomBytes,
  randomUUID,
  timingSafeEqual,
  type KeyObject,
} from 'node:crypto'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import OAuthClient from '#models/oauth_client'
import User from '#models/user'
import AppEntitlement from '#models/app_entitlement'
import AuditLog from '#models/audit_log'

export const ACCESS_TOKEN_TTL = 3600
const CODE_TTL_SECONDS = 600

/** A refresh token lasts this long after its last use… */
const REFRESH_SLIDING_DAYS = 30
/** …but never longer than this from when the user authorized. */
const REFRESH_ABSOLUTE_DAYS = 90
/** Dead grants are deleted once they have been dead this long. */
const PRUNE_AFTER_DAYS = 30

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const newRefreshToken = () => randomBytes(32).toString('base64url')
const refreshExpiry = () => new Date(Date.now() + REFRESH_SLIDING_DAYS * 86_400_000)

export class OAuthError extends Error {
  constructor(
    public code: string,
    public description: string,
    public status = 400
  ) {
    super(description)
  }
}

const sha256Hex = (v: string) => createHash('sha256').update(v).digest('hex')
const b64url = (v: Buffer | string) => Buffer.from(v).toString('base64url')

type Keys = { privateKey: KeyObject; publicKey: KeyObject; kid: string }
let keys: Keys | null = null

function loadKeys(): Keys {
  if (keys) return keys
  const b64 = env.get('OAUTH_PRIVATE_KEY_B64')
  if (!b64) throw new OAuthError('server_error', 'Token signing key is not configured.', 500)
  const privateKey = createPrivateKey(Buffer.from(b64, 'base64').toString('utf8'))
  const publicKey = createPublicKey(privateKey)
  const kid = sha256Hex(JSON.stringify(publicKey.export({ format: 'jwk' }))).slice(0, 16)
  keys = { privateKey, publicKey, kid }
  return keys
}

export const issuer = () => env.get('APP_URL').replace(/\/$/, '')

export default class OAuthService {
  // ---- JWT (RS256) -------------------------------------------------------

  static sign(claims: Record<string, unknown>): string {
    const { privateKey, kid } = loadKeys()
    const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid }))
    const body = b64url(JSON.stringify(claims))
    const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(privateKey)
    return `${head}.${body}.${b64url(sig)}`
  }

  /**
   * Returns the claims if the signature and expiry are valid, else null.
   * `allowExpired` is for `id_token_hint` at logout, which may be long expired.
   */
  static verify(token: string, options?: { allowExpired?: boolean }): Record<string, any> | null {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    try {
      const { publicKey } = loadKeys()
      const ok = createVerify('RSA-SHA256')
        .update(`${parts[0]}.${parts[1]}`)
        .verify(publicKey, Buffer.from(parts[2], 'base64url'))
      if (!ok) return null
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
      if (header.alg !== 'RS256') return null
      const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
      if (typeof claims.exp !== 'number') return null
      if (!options?.allowExpired && claims.exp * 1000 < Date.now()) return null
      if (claims.iss !== issuer()) return null
      return claims
    } catch {
      return null
    }
  }

  static jwks() {
    const { publicKey, kid } = loadKeys()
    return { keys: [{ ...publicKey.export({ format: 'jwk' }), use: 'sig', alg: 'RS256', kid }] }
  }

  // ---- Authorization codes ----------------------------------------------

  static async issueCode(input: {
    clientDbId: string
    userId: string
    redirectUri: string
    scopes: string[]
    codeChallenge: string | null
    codeChallengeMethod: string | null
    nonce: string | null
    authTime?: number | null
    amr?: string[] | null
  }): Promise<string> {
    const code = randomBytes(32).toString('base64url')
    await db.table('oauth_authorization_code').insert({
      code_hash: sha256Hex(code),
      oauth_client_id: input.clientDbId,
      user_id: input.userId,
      redirect_uri: input.redirectUri,
      scopes: input.scopes,
      code_challenge: input.codeChallenge,
      code_challenge_method: input.codeChallengeMethod,
      nonce: input.nonce,
      auth_time: input.authTime ? DateTime.fromSeconds(input.authTime).toJSDate() : null,
      amr: input.amr ?? null,
      expires_at: DateTime.now().plus({ seconds: CODE_TTL_SECONDS }).toJSDate(),
    })
    return code
  }

  // ---- Client authentication --------------------------------------------

  static async authenticateClient(
    authorization: string | undefined,
    body: Record<string, unknown>
  ): Promise<OAuthClient> {
    let clientId = typeof body.client_id === 'string' ? body.client_id : ''
    let secret = typeof body.client_secret === 'string' ? body.client_secret : ''

    if (authorization?.toLowerCase().startsWith('basic ')) {
      const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8')
      const idx = decoded.indexOf(':')
      if (idx > 0) {
        clientId = decodeURIComponent(decoded.slice(0, idx))
        secret = decodeURIComponent(decoded.slice(idx + 1))
      }
    }

    const fail = () => new OAuthError('invalid_client', 'Client authentication failed.', 401)
    if (!clientId) throw fail()

    const client = await OAuthClient.query()
      .where('client_id', clientId)
      .whereNull('deleted_at')
      .preload('app')
      .first()
    if (!client || !client.app || !client.app.isActive || client.app.deletedAt) throw fail()

    if (client.tokenEndpointAuthMethod !== 'none') {
      if (!secret || !client.clientSecretHash) throw fail()
      const a = Buffer.from(sha256Hex(secret))
      const b = Buffer.from(client.clientSecretHash)
      if (a.length !== b.length || !timingSafeEqual(a, b)) throw fail()
    }
    return client
  }

  // ---- Code exchange ----------------------------------------------------

  static async exchangeCode(
    client: OAuthClient,
    input: { code: string; redirectUri: string; codeVerifier: string | null }
  ) {
    // Atomically mark used so a code can be redeemed exactly once.
    const rows = await db
      .from('oauth_authorization_code')
      .where('code_hash', sha256Hex(input.code))
      .whereNull('used_at')
      .where('expires_at', '>', new Date())
      .update({ used_at: new Date() })
      .returning('*')
    const row = rows[0]
    const bad = () =>
      new OAuthError('invalid_grant', 'The authorization code is invalid or expired.')

    if (!row || row.oauth_client_id !== client.id) throw bad()
    if (row.redirect_uri !== input.redirectUri) throw bad()

    if (row.code_challenge) {
      if (!input.codeVerifier || !/^[A-Za-z0-9\-._~]{43,128}$/.test(input.codeVerifier)) throw bad()
      const expected =
        row.code_challenge_method === 'S256'
          ? createHash('sha256').update(input.codeVerifier).digest('base64url')
          : input.codeVerifier
      const a = Buffer.from(expected)
      const b = Buffer.from(row.code_challenge)
      if (a.length !== b.length || !timingSafeEqual(a, b)) throw bad()
    } else if (client.requirePkce) {
      throw bad()
    }

    const user = await User.query()
      .where('id', row.user_id)
      .whereNull('deleted_at')
      .whereNull('banned_at')
      .first()
    if (!user) throw bad()

    const scopes: string[] = row.scopes ?? []
    // Real sign-in moment captured at consent (L4), not redemption time.
    const authTime = row.auth_time
      ? Math.floor(new Date(row.auth_time).getTime() / 1000)
      : Math.floor(Date.now() / 1000)
    const amr: string[] | null = Array.isArray(row.amr) ? row.amr : null
    // Access may have been revoked between consent and code redemption.
    const entitled = await AppEntitlement.query()
      .where('user_id', user.id)
      .where('app_id', client.appId ?? '')
      .where('enabled', true)
      .first()
    if (!entitled) throw bad()

    // Every redemption starts a grant: the handle that lets this authorization
    // be revoked, and (with offline_access) refreshed.
    const grantId = randomUUID()
    const refreshToken = scopes.includes('offline_access') ? newRefreshToken() : null
    await this.pruneGrants()
    await db.table('oauth_grant').insert({
      id: grantId,
      oauth_client_id: client.id,
      user_id: user.id,
      scopes,
      refresh_token_hash: refreshToken ? sha256Hex(refreshToken) : null,
      refresh_expires_at: refreshToken ? refreshExpiry() : null,
    })

    return this.mintTokens(client, user, {
      grantId,
      scopes,
      refreshToken,
      nonce: row.nonce ?? null,
      authTime,
      amr,
    })
  }

  // ---- Refresh tokens ---------------------------------------------------

  /**
   * refresh_token grant. The refresh token rotates on every use; presenting
   * one that was already rotated away means it leaked, so the whole grant is
   * revoked.
   */
  static async refresh(
    client: OAuthClient,
    input: { refreshToken: string; scope: string | null; ip: string | null }
  ) {
    const hash = sha256Hex(input.refreshToken)
    const bad = () =>
      new OAuthError('invalid_grant', 'The refresh token is invalid, expired or revoked.')

    const replayed = await db.from('oauth_grant').where('previous_refresh_token_hash', hash).first()
    if (replayed) {
      if (replayed.oauth_client_id === client.id && !replayed.revoked_at) {
        await this.revokeGrant(replayed.id, 'refresh_token_reuse')
        await AuditLog.create({
          actorId: replayed.user_id,
          action: 'oauth.refresh_reuse_detected',
          resourceType: 'oauth_client',
          resourceId: client.id,
          status: 'failure',
          ipAddress: input.ip,
          metadata: { app: client.clientId, grantId: replayed.id },
        })
      }
      throw bad()
    }

    const grant = await db
      .from('oauth_grant')
      .where('refresh_token_hash', hash)
      .whereNull('revoked_at')
      .first()
    if (!grant || grant.oauth_client_id !== client.id) throw bad()

    const now = Date.now()
    const absoluteLimit = new Date(grant.created_at).getTime() + REFRESH_ABSOLUTE_DAYS * 86_400_000
    if (!grant.refresh_expires_at || new Date(grant.refresh_expires_at).getTime() <= now)
      throw bad()
    if (absoluteLimit <= now) throw bad()

    const user = await User.query()
      .where('id', grant.user_id)
      .whereNull('deleted_at')
      .whereNull('banned_at')
      .first()
    const entitled =
      user &&
      (await AppEntitlement.query()
        .where('user_id', user.id)
        .where('app_id', client.appId ?? '')
        .where('enabled', true)
        .first())
    if (!user || !entitled) {
      await this.revokeGrant(grant.id, user ? 'access_removed' : 'user_unavailable')
      throw bad()
    }

    const granted: string[] = grant.scopes ?? []
    let scopes = granted
    if (input.scope) {
      const requested = input.scope.split(/\s+/).filter(Boolean)
      if (requested.some((s) => !granted.includes(s))) {
        throw new OAuthError('invalid_scope', 'The requested scope exceeds the original grant.')
      }
      scopes = requested
    }

    // Rotate atomically; losing the race to another request counts as a replay.
    const refreshToken = newRefreshToken()
    const rotated = await db
      .from('oauth_grant')
      .where('id', grant.id)
      .where('refresh_token_hash', hash)
      .whereNull('revoked_at')
      .update({
        previous_refresh_token_hash: hash,
        refresh_token_hash: sha256Hex(refreshToken),
        refresh_expires_at: refreshExpiry(),
        last_used_at: new Date(),
        updated_at: new Date(),
      })
      .returning('id')
    if (rotated.length === 0) throw bad()

    return this.mintTokens(client, user, {
      grantId: grant.id,
      scopes,
      refreshToken,
      nonce: null,
      authTime: null,
    })
  }

  // ---- Revocation and introspection --------------------------------------

  /** The grant behind an access-token claim set, or null if gone or revoked. */
  static async activeGrant(claims: Record<string, any>) {
    const gid = typeof claims.gid === 'string' ? claims.gid : ''
    if (!UUID.test(gid) || typeof claims.sub !== 'string') return null
    const row = await db
      .from('oauth_grant')
      .where('id', gid)
      .where('user_id', claims.sub)
      .whereNull('revoked_at')
      .first()
    return row ?? null
  }

  /** Revoke one grant: its access tokens stop validating, its refresh token dies. */
  static async revokeGrant(grantId: string, reason: string) {
    await db
      .from('oauth_grant')
      .where('id', grantId)
      .whereNull('revoked_at')
      .update({ revoked_at: new Date(), revoked_reason: reason, updated_at: new Date() })
  }

  /**
   * Revoke a user's grants, optionally only those for one app. Returns how
   * many were revoked. Used when access is removed or the account is disabled.
   */
  static async revokeUserGrants(
    userId: string,
    reason: string,
    options?: { appId?: string }
  ): Promise<number> {
    const query = db.from('oauth_grant').where('user_id', userId).whereNull('revoked_at')
    if (options?.appId) {
      query.whereIn(
        'oauth_client_id',
        db.from('oauth_client').select('id').where('app_id', options.appId)
      )
    }
    const revoked = await query
      .update({ revoked_at: new Date(), revoked_reason: reason, updated_at: new Date() })
      .returning('id')
    return revoked.length
  }

  /** Revoke every grant of every client belonging to an app. */
  static async revokeAppGrants(appId: string, reason: string): Promise<number> {
    const revoked = await db
      .from('oauth_grant')
      .whereNull('revoked_at')
      .whereIn('oauth_client_id', db.from('oauth_client').select('id').where('app_id', appId))
      .update({ revoked_at: new Date(), revoked_reason: reason, updated_at: new Date() })
      .returning('id')
    return revoked.length
  }

  /**
   * RFC 7009. Revokes the grant behind an access or refresh token that was
   * issued to this client. Unknown or foreign tokens are silently ignored, as
   * the RFC requires. Returns the revoked grant id for auditing.
   */
  static async revokeToken(client: OAuthClient, token: string): Promise<string | null> {
    const grant = await this.findGrantByToken(client, token, { includeExpired: true })
    if (!grant) return null
    await this.revokeGrant(grant.id, 'client_revoked')
    return grant.id
  }

  /** RFC 7662 introspection of a token issued to this client. */
  static async introspect(client: OAuthClient, token: string): Promise<Record<string, unknown>> {
    const inactive = { active: false }
    const claims = token.split('.').length === 3 ? this.verify(token) : null

    if (claims) {
      if (claims.token_use !== 'access' || claims.client_id !== client.clientId) return inactive
      if (!(await this.activeGrant(claims))) return inactive
      if (!(await this.userIsActive(claims.sub))) return inactive
      return {
        active: true,
        scope: claims.scope,
        client_id: claims.client_id,
        sub: claims.sub,
        token_type: 'Bearer',
        exp: claims.exp,
        iat: claims.iat,
        iss: claims.iss,
        aud: claims.aud,
        jti: claims.jti,
      }
    }

    const grant = await this.findGrantByToken(client, token, { includeExpired: false })
    if (!grant || !(await this.userIsActive(grant.user_id))) return inactive
    return {
      active: true,
      scope: (grant.scopes ?? []).join(' '),
      client_id: client.clientId,
      sub: grant.user_id,
      exp: Math.floor(new Date(grant.refresh_expires_at).getTime() / 1000),
      iat: Math.floor(new Date(grant.created_at).getTime() / 1000),
      iss: issuer(),
    }
  }

  static async userIsActive(userId: string): Promise<boolean> {
    const user = await User.query()
      .where('id', userId)
      .whereNull('deleted_at')
      .whereNull('banned_at')
      .first()
    return Boolean(user)
  }

  /** Delete grants nobody can use any more, so the table doesn't grow forever. */
  private static async pruneGrants() {
    const cutoff = new Date(Date.now() - PRUNE_AFTER_DAYS * 86_400_000)
    await db
      .from('oauth_grant')
      .where((q) => {
        q.where('revoked_at', '<', cutoff).orWhere('created_at', '<', cutoff)
      })
      .where((q) => {
        q.whereNull('refresh_expires_at').orWhere('refresh_expires_at', '<', new Date())
      })
      .delete()
  }

  /** Find the grant a JWT access token or a refresh token (current or rotated) belongs to. */
  private static async findGrantByToken(
    client: OAuthClient,
    token: string,
    options: { includeExpired: boolean }
  ) {
    const claims = token.split('.').length === 3 ? this.verify(token) : null
    if (claims) {
      if (claims.token_use !== 'access' || claims.client_id !== client.clientId) return null
      return this.activeGrant(claims)
    }

    const hash = sha256Hex(token)
    const grant = await db
      .from('oauth_grant')
      .where((q) => {
        q.where('refresh_token_hash', hash).orWhere('previous_refresh_token_hash', hash)
      })
      .whereNull('revoked_at')
      .first()
    if (!grant || grant.oauth_client_id !== client.id) return null
    if (
      !options.includeExpired &&
      (!grant.refresh_expires_at || new Date(grant.refresh_expires_at).getTime() <= Date.now())
    ) {
      return null
    }
    return grant
  }

  /** Sign the access token (and ID token for `openid`) and shape the token response. */
  private static async mintTokens(
    client: OAuthClient,
    user: User,
    input: {
      grantId: string
      scopes: string[]
      refreshToken: string | null
      nonce: string | null
      authTime: number | null
      amr?: string[] | null
    }
  ) {
    const { scopes } = input
    const now = Math.floor(Date.now() / 1000)
    const base = { iss: issuer(), sub: user.id, aud: client.clientId, iat: now }

    const response: Record<string, unknown> = {
      access_token: this.sign({
        ...base,
        exp: now + ACCESS_TOKEN_TTL,
        jti: randomUUID(),
        gid: input.grantId,
        token_use: 'access',
        client_id: client.clientId,
        scope: scopes.join(' '),
      }),
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL,
      scope: scopes.join(' '),
    }
    if (input.refreshToken) response.refresh_token = input.refreshToken
    if (scopes.includes('openid')) {
      response.id_token = this.sign({
        ...base,
        exp: now + ACCESS_TOKEN_TTL,
        token_use: 'id',
        ...(input.authTime ? { auth_time: input.authTime } : {}),
        ...(input.amr ? { amr: input.amr } : {}),
        ...(input.nonce ? { nonce: input.nonce } : {}),
        ...(await this.userClaims(user, scopes)),
      })
    }
    return response
  }

  /** Profile / entitlement claims, filtered by the granted scopes. */
  static async userClaims(user: User, scopes: string[]) {
    const claims: Record<string, unknown> = {}
    if (scopes.includes('profile')) {
      claims.name = user.name
      claims.email = user.email
      claims.email_verified = user.emailVerified
      claims.picture = user.image
    }
    if (scopes.includes('entitlements')) {
      const rows = await AppEntitlement.query()
        .where('user_id', user.id)
        .where('enabled', true)
        .preload('app')
      claims.app_access = rows
        .filter((e) => e.app && e.app.isActive && !e.app.deletedAt)
        .map((e) => e.app.slug.toLowerCase())
    }
    return claims
  }
}
