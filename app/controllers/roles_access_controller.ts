import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Role from '#models/role'
import Permission from '#models/permission'
import AuditLog from '#models/audit_log'
import { accessFor, SUPERADMIN_ONLY_KEYS } from '#services/access_service'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Roles & access — `/roles-access` · Utility · ACCESS nav.
 * Role cards + sectioned permission matrix with single-diff save.
 * Superadmin column is fully locked (spec + Key Risk #1: red adjacency
 * stays out — no destructive control lives on this page).
 */
const SECTION_ORDER = [
  'users',
  'sessions',
  'apps',
  'entitlements',
  'oauth',
  'audit',
  'roles',
  'settings',
]

const SECTION_LABELS: Record<string, string> = {
  users: 'USERS',
  sessions: 'SESSIONS',
  apps: 'APPS',
  entitlements: 'ENTITLEMENTS',
  oauth: 'OAUTH CLIENTS',
  audit: 'AUDIT',
  roles: 'ROLES',
  settings: 'SETTINGS',
}

const SYSTEM_ORDER = ['superadmin', 'admin', 'employee']

const matrixValidator = vine.create({
  grants: vine.array(
    vine.object({
      roleId: vine.string().uuid(),
      permissionKeys: vine.array(vine.string().maxLength(120)),
    })
  ),
  baseUpdatedAt: vine.string().optional(),
})

const storeValidator = vine.create({
  name: vine.string().trim().minLength(2).maxLength(50),
  description: vine.string().trim().maxLength(254).optional(),
  templateRoleId: vine.string().uuid().optional(),
})

function orderRoles<T extends { name: string }>(roles: T[]): T[] {
  return [...roles].sort((a, b) => {
    const ai = SYSTEM_ORDER.indexOf(a.name.toLowerCase())
    const bi = SYSTEM_ORDER.indexOf(b.name.toLowerCase())
    if (ai !== -1 || bi !== -1) {
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    }
    return a.name.localeCompare(b.name)
  })
}

export default class RolesAccessController {
  async index(ctx: HttpContext) {
    const { inertia } = ctx
    const roles = await Role.query()
      .preload('permissions')
      .preload('users', (u) => u.whereNull('deleted_at'))
    const permissions = await Permission.query().orderBy('key', 'asc')

    const access = await accessFor(ctx)

    const ordered = orderRoles(roles)
    const serialized = ordered.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      userCount: (r as any).users?.length ?? 0,
      permissionKeys: r.permissions.map((p) => p.key).sort(),
      updatedAt: r.updatedAt?.toISO?.() ?? null,
    }))

    const latestUpdate = ordered.reduce<string | null>((acc, r) => {
      const iso = r.updatedAt?.toISO?.() ?? null
      if (!iso) return acc
      return !acc || iso > acc ? iso : acc
    }, null)

    const sections = SECTION_ORDER.map((section) => {
      const items = permissions
        .filter((p) => p.section === section)
        .map((p) => ({ id: p.id, key: p.key, section: p.section, description: p.description }))
      return {
        key: section,
        label: SECTION_LABELS[section] ?? section.toUpperCase(),
        permissions: items,
      }
    }).filter((s) => s.permissions.length > 0)

    // Sections with no declared order (future keys) append alphabetically.
    const known = new Set(SECTION_ORDER)
    for (const p of permissions) {
      if (!known.has(p.section) && !sections.some((s) => s.key === p.section)) {
        sections.push({
          key: p.section,
          label: p.section.toUpperCase(),
          permissions: permissions
            .filter((x) => x.section === p.section)
            .map((x) => ({ id: x.id, key: x.key, section: x.section, description: x.description })),
        })
      }
    }

    return inertia.render('roles_access', {
      roles: serialized,
      sections,
      totalPermissions: permissions.length,
      baseUpdatedAt: latestUpdate,
      canCreateRole: access.can('roles.create'),
      canSave: access.can('roles.update'),
    })
  }

  /**
   * Save the matrix as one diff transaction. Dirty tint is local-only until
   * 2xx; nothing rolls back silently — errors keep cells dirty client-side.
   */
  async updateMatrix(ctx: HttpContext) {
    const { request, response, session, auth } = ctx
    const access = await accessFor(ctx)
    const viewerIsSuperadmin = access.isSuperadmin

    const { grants, baseUpdatedAt } = await request.validateUsing(matrixValidator)

    const roles = await Role.query().preload('permissions')
    const roleById = new Map(roles.map((r) => [r.id, r]))
    const permissions = await Permission.all()
    const permissionIdByKey = new Map(permissions.map((p) => [p.key, p.id]))
    const validKeys = new Set(permissions.map((p) => p.key))

    // Conflict: someone saved after this matrix was read.
    if (baseUpdatedAt) {
      const base = DateTime.fromISO(baseUpdatedAt)
      if (base.isValid) {
        const newer = roles.some((r) => r.updatedAt && r.updatedAt > base)
        if (newer) {
          session.flash(
            'error',
            'Permissions were changed by someone else. Your view was reloaded — review and save again.'
          )
          return response.redirect().back()
        }
      }
    }

    // Validate + enforce locks before touching the DB.
    for (const g of grants) {
      const role = roleById.get(g.roleId)
      if (!role) {
        session.flash('error', 'Unknown role in permission matrix.')
        return response.redirect().back()
      }
      for (const key of g.permissionKeys) {
        if (!validKeys.has(key)) {
          session.flash('error', `Unknown permission: ${key}.`)
          return response.redirect().back()
        }
      }
      if (role.name.toLowerCase() === 'superadmin') {
        const current = new Set(role.permissions.map((p) => p.key))
        const next = new Set(g.permissionKeys)
        const sameSize = current.size === next.size
        const same = sameSize && [...current].every((k) => next.has(k))
        if (!same) {
          session.flash('error', 'Superadmin always has every permission — that column is locked.')
          return response.redirect().back()
        }
      }
      if (!viewerIsSuperadmin) {
        for (const key of g.permissionKeys) {
          if (SUPERADMIN_ONLY_KEYS.has(key)) {
            session.flash('error', `Only superadmins can grant “${key}”.`)
            return response.redirect().back()
          }
        }
      }
    }

    const changed: { role: string; granted: string[]; revoked: string[] }[] = []

    await db.transaction(async (trx) => {
      for (const g of grants) {
        const role = roleById.get(g.roleId)!
        if (role.name.toLowerCase() === 'superadmin') continue
        const current = new Set(role.permissions.map((p) => p.key))
        const next = new Set(g.permissionKeys)
        const granted = [...next].filter((k) => !current.has(k))
        const revoked = [...current].filter((k) => !next.has(k))
        if (granted.length === 0 && revoked.length === 0) continue

        const ids = [...next].map((k) => permissionIdByKey.get(k)!)
        role.useTransaction(trx)
        await role.related('permissions').sync(ids)
        role.updatedAt = DateTime.now()
        await role.save()

        changed.push({ role: role.name, granted, revoked })

        await AuditLog.create(
          {
            actorId: auth.user?.id ?? null,
            action: 'role.permissions_updated',
            resourceType: 'role',
            resourceId: role.id,
            status: 'success',
            ipAddress: request.ip(),
            metadata: { role: role.name, granted, revoked },
          },
          { client: trx }
        )
      }
    })

    if (changed.length === 0) {
      session.flash('success', 'No permission changes to save.')
    } else {
      const total = changed.reduce((n, c) => n + c.granted.length + c.revoked.length, 0)
      session.flash('success', `Saved ${total} permission change${total === 1 ? '' : 's'}.`)
    }
    return response.redirect().back()
  }

  /** "New role" — superadmin only, starts from a template or empty. */
  async store(ctx: HttpContext) {
    const { request, response, session, auth } = ctx
    const access = await accessFor(ctx)
    const viewerIsSuperadmin = access.isSuperadmin

    const { name, description, templateRoleId } = await request.validateUsing(storeValidator)
    const slug = name.trim().toLowerCase()
    if (SYSTEM_ORDER.includes(slug)) {
      session.flash('error', `“${name.trim()}” is a system role — pick another name.`)
      return response.redirect().back()
    }
    const existing = await Role.findBy('name', slug)
    if (!existing) {
      const ci = await Role.query().whereILike('name', slug).first()
      if (ci) {
        session.flash('error', `A role named “${ci.name}” already exists.`)
        return response.redirect().back()
      }
    } else {
      session.flash('error', `A role named “${existing.name}” already exists.`)
      return response.redirect().back()
    }

    let templateKeys: string[] = []
    if (templateRoleId) {
      const template = await Role.query().where('id', templateRoleId).preload('permissions').first()
      if (!template) {
        session.flash('error', 'Template role not found.')
        return response.redirect().back()
      }
      templateKeys = template.permissions
        .map((p) => p.key)
        .filter((k) => !SUPERADMIN_ONLY_KEYS.has(k) || viewerIsSuperadmin)
    }

    const permissions = await Permission.all()
    const permissionIdByKey = new Map(permissions.map((p) => [p.key, p.id]))

    const role = await db.transaction(async (trx) => {
      const created = await Role.create(
        { name: slug, description: description?.trim() || null, isSystem: false },
        { client: trx }
      )
      const ids = templateKeys
        .map((k) => permissionIdByKey.get(k))
        .filter((v): v is string => Boolean(v))
      if (ids.length > 0) {
        created.useTransaction(trx)
        await created.related('permissions').sync(ids)
      }
      await AuditLog.create(
        {
          actorId: auth.user?.id ?? null,
          action: 'role.created',
          resourceType: 'role',
          resourceId: created.id,
          status: 'success',
          ipAddress: request.ip(),
          metadata: { role: slug, template: templateRoleId ?? null, permissions: templateKeys },
        },
        { client: trx }
      )
      return created
    })

    session.flash('success', `Role “${role.name}” created.`)
    return response.redirect().back()
  }
}
