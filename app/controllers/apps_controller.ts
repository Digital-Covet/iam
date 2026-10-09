import { createHash, randomBytes } from 'node:crypto'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import App from '#models/app'
import AuditLog from '#models/audit_log'
import OAuthClient from '#models/oauth_client'
import { accessFor } from '#services/access_service'
import OAuthService from '#services/oauth_service'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Canonical host per app slug. The card's logout-URL line shows the OAuth
 * client's first post-logout redirect URI, falling back to https://<domain>
 * so the line is never empty. Domains confirmed with the product owner:
 * Desk lives on flonion.com.
 */
const APP_DOMAINS: Record<string, string> = {
  share: 'share.digitalcovet.com',
  portfolio: 'portfolio.digitalcovet.com',
  desk: 'desk.flonion.com',
}

const AUTH_METHODS = ['client_secret_basic', 'client_secret_post', 'none'] as const

const uriList = () => vine.array(vine.string().trim().maxLength(2000)).maxLength(20)

const configFields = {
  name: vine.string().trim().minLength(2).maxLength(120),
  description: vine.string().trim().maxLength(500).nullable().optional(),
  isActive: vine.boolean().optional(),
  redirectUris: uriList(),
  postLogoutRedirectUris: uriList(),
  tokenEndpointAuthMethod: vine.enum(AUTH_METHODS),
  requirePkce: vine.boolean(),
}

const createAppValidator = vine.create({
  slug: vine
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,78}$/),
  ...configFields,
})

/** The slug is immutable: entitlements, consent and APP_DOMAINS key off it. */
const updateAppValidator = vine.create(configFields)

type ClientConfig = {
  redirectUris: string[]
  postLogoutRedirectUris: string[]
  tokenEndpointAuthMethod: (typeof AUTH_METHODS)[number]
  requirePkce: boolean
}

const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex')

function uriProblem(uri: string): string | null {
  let url: URL
  try {
    url = new URL(uri)
  } catch {
    return `“${uri}” is not a valid URL.`
  }
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) {
    return `“${uri}” must use https (http is allowed only for localhost).`
  }
  if (url.hash) return `“${uri}” must not contain a # fragment.`
  return null
}

/** First problem with a client configuration, or null when it is acceptable. */
function configProblem(config: ClientConfig): string | null {
  if (config.redirectUris.length === 0) return 'Add at least one redirect URI.'
  for (const uri of [...config.redirectUris, ...config.postLogoutRedirectUris]) {
    const problem = uriProblem(uri)
    if (problem) return problem
  }
  if (config.tokenEndpointAuthMethod === 'none' && !config.requirePkce) {
    return 'Public clients (no client secret) must require PKCE.'
  }
  return null
}

const unique = (uris: string[]) => [...new Set(uris.map((u) => u.trim()).filter(Boolean))]

export default class AppsController {
  async index(ctx: HttpContext) {
    const { inertia, session } = ctx
    const apps = await App.query()
      .whereNull('deleted_at')
      .preload('oauthClients', (q) => q.whereNull('deleted_at'))
      .orderBy('name', 'asc')

    const entitlementCounts = await db
      .from('app_entitlement')
      .select('app_id')
      .count('* as total')
      .where('enabled', true)
      .groupBy('app_id')
    const countByAppId = new Map<string, number>(
      entitlementCounts.map((r: any) => [String(r.app_id), Number(r.total)])
    )

    const access = await accessFor(ctx)

    const rotatedAppId = session.flashMessages.get('rotatedAppId') as string | undefined
    const rotatedSecret = session.flashMessages.get('rotatedSecret') as string | undefined

    return inertia.render('apps', {
      apps: apps.map((a) => {
        const slug = a.slug.toLowerCase()
        const client = a.oauthClients[0] ?? null
        const logoutUrl =
          client?.postLogoutRedirectUris?.[0] ??
          (APP_DOMAINS[slug] ? `https://${APP_DOMAINS[slug]}` : null)
        return {
          id: a.id,
          slug,
          name: a.name,
          description: a.description,
          isActive: a.isActive,
          clientId: client?.clientId ?? null,
          logoutUrl,
          userCount: countByAppId.get(a.id) ?? 0,
          redirectUris: client?.redirectUris ?? [],
          postLogoutRedirectUris: client?.postLogoutRedirectUris ?? [],
          tokenEndpointAuthMethod: client?.tokenEndpointAuthMethod ?? null,
          requirePkce: client?.requirePkce ?? null,
        }
      }),
      // The routes enforce these; the page uses them to hide controls.
      canRegister: access.canAll(['apps.create', 'oauth.clients.manage']),
      canEdit: access.canAll(['apps.update', 'oauth.clients.manage']),
      canDelete: access.canAll(['apps.delete', 'oauth.clients.manage']),
      canManageClients: access.can('oauth.clients.manage'),
      rotated:
        rotatedAppId && rotatedSecret ? { appId: rotatedAppId, secret: rotatedSecret } : null,
    })
  }

  /**
   * Register an app together with its OAuth client. Superadmin only. A
   * confidential client's secret travels back as a one-request flash, exactly
   * like a rotation, and is never stored in plain text.
   */
  async store(ctx: HttpContext) {
    const { request, response, session } = ctx

    const data = await request.validateUsing(createAppValidator)
    const config = this.#configOf(data)

    const problem = configProblem(config)
    if (problem) {
      session.flash('error', problem)
      return response.redirect().back()
    }

    // The unique index also covers soft-deleted apps, so check them too.
    const taken = await App.query().whereRaw('lower(slug) = ?', [data.slug]).first()
    if (taken) {
      session.flash('error', `The slug “${data.slug}” is already used by another app.`)
      return response.redirect().back()
    }

    const plain = this.#newSecret(config)
    const { app, client } = await db.transaction(async (trx) => {
      const created = await App.create(
        {
          slug: data.slug,
          name: data.name,
          description: data.description?.trim() || null,
          isActive: data.isActive ?? true,
        },
        { client: trx }
      )
      const createdClient = await OAuthClient.create(
        {
          appId: created.id,
          clientId: `${data.slug}-${randomBytes(12).toString('hex')}`,
          clientSecretHash: plain ? sha256Hex(plain) : null,
          ...config,
        },
        { client: trx }
      )
      return { app: created, client: createdClient }
    })

    await this.#audit(ctx, 'app.created', app, { slug: app.slug, clientId: client.clientId })

    this.#flashSecret(session, app, plain, `${app.name} is registered.`)
    return response.redirect().back()
  }

  /**
   * Edit an app and its OAuth client. Superadmin only. An app that has no
   * client yet (for example a seeded one) gets one created here.
   */
  async update(ctx: HttpContext) {
    const { params, request, response, session } = ctx

    const app = await App.query().whereNull('deleted_at').where('id', params.id).firstOrFail()
    const data = await request.validateUsing(updateAppValidator)
    const config = this.#configOf(data)

    const problem = configProblem(config)
    if (problem) {
      session.flash('error', problem)
      return response.redirect().back()
    }

    const client = await app.related('oauthClients').query().whereNull('deleted_at').first()
    const changed: string[] = []
    const track = (field: string, before: unknown, after: unknown) => {
      if (JSON.stringify(before) !== JSON.stringify(after)) changed.push(field)
    }

    const description = data.description?.trim() || null
    const isActive = data.isActive ?? app.isActive
    track('name', app.name, data.name)
    track('description', app.description, description)
    track('isActive', app.isActive, isActive)

    let plain: string | null = null
    await db.transaction(async (trx) => {
      app.useTransaction(trx)
      app.merge({ name: data.name, description, isActive })
      await app.save()

      if (!client) {
        plain = this.#newSecret(config)
        await OAuthClient.create(
          {
            appId: app.id,
            clientId: `${app.slug.toLowerCase()}-${randomBytes(12).toString('hex')}`,
            clientSecretHash: plain ? sha256Hex(plain) : null,
            ...config,
          },
          { client: trx }
        )
        changed.push('oauthClient')
        return
      }

      track('redirectUris', client.redirectUris, config.redirectUris)
      track('postLogoutRedirectUris', client.postLogoutRedirectUris, config.postLogoutRedirectUris)
      track(
        'tokenEndpointAuthMethod',
        client.tokenEndpointAuthMethod,
        config.tokenEndpointAuthMethod
      )
      track('requirePkce', client.requirePkce, config.requirePkce)

      // Switching to a public client drops the secret; switching back to a
      // confidential one issues a fresh secret because none exists to keep.
      if (config.tokenEndpointAuthMethod === 'none') {
        client.clientSecretHash = null
      } else if (!client.clientSecretHash) {
        plain = this.#newSecret(config)
        client.clientSecretHash = plain ? sha256Hex(plain) : null
        changed.push('clientSecret')
      }

      client.useTransaction(trx)
      client.merge(config)
      await client.save()
    })

    if (!app.isActive) await OAuthService.revokeAppGrants(app.id, 'app_deactivated')
    await this.#audit(ctx, 'app.updated', app, { slug: app.slug, changed })

    this.#flashSecret(session, app, plain, `${app.name} is updated.`)
    return response.redirect().back()
  }

  /**
   * Soft-delete an app and its OAuth clients. Superadmin only. Existing
   * entitlements are kept so the directory history stays intact.
   */
  async destroy(ctx: HttpContext) {
    const { params, response, session } = ctx

    const app = await App.query().whereNull('deleted_at').where('id', params.id).firstOrFail()
    const now = DateTime.now()

    await db.transaction(async (trx) => {
      app.useTransaction(trx)
      app.deletedAt = now
      app.isActive = false
      await app.save()
      await OAuthClient.query({ client: trx })
        .where('app_id', app.id)
        .whereNull('deleted_at')
        .update({ deleted_at: now.toSQL() })
    })

    await OAuthService.revokeAppGrants(app.id, 'app_deleted')
    await this.#audit(ctx, 'app.deleted', app, { slug: app.slug })

    session.flash('success', `${app.name} is deleted. Sign-ins to it stop immediately.`)
    return response.redirect().back()
  }

  /**
   * Rotate an app's OAuth client secret. Superadmin only — the button is
   * hidden for other roles, this is the server-side enforcement. The plain
   * secret travels back as a one-request flash (never persisted, never
   * logged) and renders once inside the still-open Manage dialog.
   */
  async rotate(ctx: HttpContext) {
    const { params, request, response, session, auth } = ctx

    const app = await App.query().whereNull('deleted_at').where('id', params.id).firstOrFail()
    const client = await app.related('oauthClients').query().whereNull('deleted_at').first()
    if (!client) {
      session.flash('error', `No OAuth client is linked to ${app.name} yet.`)
      return response.redirect().back()
    }
    if (client.tokenEndpointAuthMethod === 'none') {
      session.flash('error', `${app.name} is a public client and has no secret to rotate.`)
      return response.redirect().back()
    }

    const plain = randomBytes(32).toString('base64url')
    client.clientSecretHash = sha256Hex(plain)
    await client.save()

    await AuditLog.create({
      actorId: auth.user?.id ?? null,
      action: 'oauth.secret_rotated',
      resourceType: 'oauth_client',
      resourceId: client.id,
      status: 'success',
      ipAddress: request.ip(),
      metadata: { app: app.slug.toLowerCase() },
    })

    session.flash(
      'success',
      `Client secret rotated for ${app.name}. Copy it now — it won't be shown again.`
    )
    session.flash('rotatedAppId', app.id)
    session.flash('rotatedSecret', plain)
    return response.redirect().back()
  }

  #configOf(data: {
    redirectUris: string[]
    postLogoutRedirectUris: string[]
    tokenEndpointAuthMethod: (typeof AUTH_METHODS)[number]
    requirePkce: boolean
  }): ClientConfig {
    return {
      redirectUris: unique(data.redirectUris),
      postLogoutRedirectUris: unique(data.postLogoutRedirectUris),
      tokenEndpointAuthMethod: data.tokenEndpointAuthMethod,
      requirePkce: data.requirePkce,
    }
  }

  /** A fresh plain secret for confidential clients; public clients have none. */
  #newSecret(config: ClientConfig): string | null {
    return config.tokenEndpointAuthMethod === 'none' ? null : randomBytes(32).toString('base64url')
  }

  #flashSecret(session: HttpContext['session'], app: App, plain: string | null, message: string) {
    if (!plain) {
      session.flash('success', message)
      return
    }
    session.flash('success', `${message} Copy the client secret now — it won't be shown again.`)
    session.flash('rotatedAppId', app.id)
    session.flash('rotatedSecret', plain)
  }

  async #audit(
    { request, auth }: HttpContext,
    action: string,
    app: App,
    metadata: Record<string, unknown>
  ) {
    await AuditLog.create({
      actorId: auth.user?.id ?? null,
      action,
      resourceType: 'app',
      resourceId: app.id,
      status: 'success',
      ipAddress: request.ip(),
      metadata,
    })
  }
}
