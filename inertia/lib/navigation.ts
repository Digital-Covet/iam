import {
  AppWindow,
  LayoutDashboard,
  ScrollText,
  Settings2,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  /** Mirrors the permission gate on the route in start/routes.ts. UI hint only; the server enforces. */
  requires?: { all?: string[]; any?: string[] }
}

export type NavGroup = { label: string; items: NavItem[] }

export const navGroups: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Directory', href: '/', icon: Users, requires: { all: ['users.read'] } },
    ],
  },
  {
    label: 'Access',
    items: [
      {
        label: 'Roles & access',
        href: '/roles-access',
        icon: ShieldCheck,
        requires: { all: ['roles.read'] },
      },
      {
        label: 'Applications',
        href: '/apps',
        icon: AppWindow,
        requires: { all: ['apps.read', 'oauth.clients.read'] },
      },
    ],
  },
  {
    label: 'Security',
    items: [
      {
        label: 'Audit log',
        href: '/audit-logs',
        icon: ScrollText,
        requires: { all: ['audit.read'] },
      },
      {
        label: 'Auth settings',
        href: '/auth-settings',
        icon: Settings2,
        requires: { any: ['settings.password_policy.read', 'settings.auth_methods.read'] },
      },
    ],
  },
]

export function isActivePath(url: string, href: string) {
  const path = url.split('?')[0]
  return href === '/' ? path === '/' || path.startsWith('/directory') : path.startsWith(href)
}
