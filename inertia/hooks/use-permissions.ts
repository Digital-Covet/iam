import { usePage } from '@inertiajs/react'

type Requirement = { all?: string[]; any?: string[] }

/**
 * Client-side hint for showing or hiding controls. The server remains the
 * authority: every route re-checks the permission.
 */
export function usePermissions() {
  const { access } = usePage().props
  const granted = new Set(access?.permissions ?? [])
  const isSuperadmin = Boolean(access?.isSuperadmin)

  const can = (permission: string) => isSuperadmin || granted.has(permission)

  const satisfies = (req?: Requirement) => {
    if (!req || isSuperadmin) return true
    return (!req.all || req.all.every(can)) && (!req.any || req.any.some(can))
  }

  return { can, satisfies, isSuperadmin }
}
