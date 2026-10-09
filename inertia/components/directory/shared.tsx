import { useState } from 'react'
import { router } from '@inertiajs/react'
import type { RequestPayload } from '@inertiajs/core'
import { Checkbox } from '@base-ui/react/checkbox'
import { Select } from '@base-ui/react/select'
import {
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  Mail,
  ShieldCheck,
  ShieldOff,
  type LucideIcon,
} from 'lucide-react'
import { cn, initialsOf } from '~/lib/utils'

export type Status = 'active' | 'invited' | 'suspended'

export type RoleOption = { id: string; name: string; description: string | null }
export type AppOption = { id: string; slug: string; name: string }

export type DirectoryUser = {
  id: string
  name: string | null
  email: string
  initials: string | null
  image: string | null
  role: RoleOption | null
  roleName: string
  status: Status
  emailVerified: boolean
  bannedAt: string | null
  banReason: string | null
  twoFactorEnabled: boolean
  apps: Record<string, boolean>
  lastActive: string | null
  joined: string | null
}

export type UserDetail = {
  id: string
  entitlements: { appId: string; slug: string; name: string; enabled: boolean; claim: string }[]
  sessions: {
    id: string
    ip: string | null
    agent: string | null
    geo: string | null
    lastActive: string | null
    created: string | null
  }[]
  audit: { id: string; action: string; status: string; created: string | null }[]
}

export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export const fieldClass = cn(
  'h-11 w-full rounded-lg border border-border-strong bg-surface px-3 text-base text-foreground placeholder:text-muted-foreground transition-colors duration-140 motion-reduce:transition-none aria-invalid:border-error',
  focusRing
)

const btnBase = cn(
  'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors duration-140 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none',
  focusRing
)
export const btnPrimary = cn(
  btnBase,
  'bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.18)] hover:bg-primary/90 disabled:hover:bg-primary motion-safe:active:translate-y-px'
)
export const btnSecondary = cn(
  btnBase,
  'border border-border-strong bg-surface text-foreground hover:bg-hover'
)
export const btnDanger = cn(
  btnBase,
  'bg-error text-primary-foreground hover:bg-error/90 disabled:hover:bg-error'
)

export const dialogBackdrop =
  'fixed inset-0 z-50 bg-black/40 transition-opacity duration-140 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none'

export const stampFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
export const dayFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export function Stamp({ value, day }: { value: string | null; day?: boolean }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  const date = new Date(value)
  return (
    <time dateTime={value} className="tabular-nums">
      {(day ? dayFmt : stampFmt).format(date)}
    </time>
  )
}

const statusMeta: Record<Status, { label: string; icon: LucideIcon; tone: string }> = {
  active: {
    label: 'Active',
    icon: CheckCircle2,
    tone: 'text-success',
  },
  invited: { label: 'Invited', icon: Mail, tone: 'text-info' },
  suspended: { label: 'Suspended', icon: Ban, tone: 'text-error' },
}

/** Icon + word label, never colour alone. */
export function StatusBadge({ status }: { status: Status }) {
  const { label, icon: Icon, tone } = statusMeta[status]
  return (
    <span className={cn('stamp-chip', tone)}>
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  )
}

export function TwoFactorBadge({ enabled }: { enabled: boolean }) {
  const Icon = enabled ? ShieldCheck : ShieldOff
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5',
        enabled ? 'text-success' : 'text-muted-foreground'
      )}
    >
      <Icon size={16} aria-hidden="true" />
      {enabled ? 'On' : 'Off'}
    </span>
  )
}

export function Avatar({ user, size = 32 }: { user: DirectoryUser; size?: number }) {
  const [broken, setBroken] = useState(false)
  const initials = user.initials || initialsOf(user.name, user.email)
  const box = { width: size, height: size }
  if (user.image && !broken) {
    return (
      <img
        src={user.image}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        style={box}
        className="stamp shrink-0 rounded-md object-contain p-0.5"
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...box, fontSize: size >= 48 ? 16 : 12 }}
      className="stamp grid shrink-0 place-items-center rounded-md font-semibold text-primary"
    >
      {initials}
    </span>
  )
}

export type SelectOption = { value: string; label: string; disabled?: boolean }

/** Labelled Base UI Select styled like the text fields. */
export function SelectField({
  label,
  value,
  onValueChange,
  options,
  disabled,
  describedBy,
  invalid,
  className,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  disabled?: boolean
  describedBy?: string
  invalid?: boolean
  className?: string
}) {
  return (
    <Select.Root
      value={value}
      items={options}
      disabled={disabled}
      onValueChange={(next) => next !== null && onValueChange(String(next))}
    >
      <div className={cn('space-y-1.5', className)}>
        <Select.Label className="block text-sm font-medium">{label}</Select.Label>
        <Select.Trigger
          aria-describedby={describedBy}
          aria-invalid={invalid ? true : undefined}
          className={cn(
            fieldClass,
            'flex cursor-pointer items-center justify-between gap-2 text-left data-disabled:cursor-not-allowed data-disabled:opacity-60'
          )}
        >
          <Select.Value className="truncate" />
          <Select.Icon>
            <ChevronDown size={16} aria-hidden="true" className="text-muted-foreground" />
          </Select.Icon>
        </Select.Trigger>
      </div>
      <Select.Portal>
        <Select.Positioner sideOffset={4} alignItemWithTrigger={false} className="z-[70]">
          <Select.Popup className="max-h-72 min-w-(--anchor-width) overflow-y-auto rounded-2xl border border-border bg-surface-raised p-2 shadow-float outline-none transition-opacity duration-140 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none">
            <Select.List>
              {options.map((o) => (
                <Select.Item
                  key={o.value}
                  value={o.value}
                  disabled={o.disabled}
                  className="flex h-10 cursor-pointer items-center gap-2 rounded-md px-3 text-sm outline-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-highlighted:bg-primary/10 data-highlighted:text-primary"
                >
                  <Select.ItemIndicator className="w-4">
                    <Check size={16} aria-hidden="true" />
                  </Select.ItemIndicator>
                  <Select.ItemText className="col-start-2">{o.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}

export function displayName(user: Pick<DirectoryUser, 'name' | 'email'>) {
  return user.name?.trim() || user.email
}

/** "Chrome on Windows" from a raw user-agent string; falls back to the string itself. */
export function describeAgent(ua: string | null) {
  if (!ua) return 'Unknown device'
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : null
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad/.test(ua)
        ? 'iOS'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : null
  if (browser && os) return `${browser} on ${os}`
  return browser ?? os ?? ua.slice(0, 60)
}

export function humanizeAction(action: string) {
  const text = action.replace(/[._]/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

type Method = 'post' | 'patch' | 'delete'

/**
 * One path for every directory mutation: keep scroll and local state, let the
 * server's flash message reach the toaster, and report whether it succeeded
 * (the server redirects back even when it refuses, so check the flash).
 */
export function mutate(
  method: Method,
  url: string,
  data: RequestPayload | undefined,
  done?: (ok: boolean) => void
) {
  const options = {
    preserveScroll: true,
    preserveState: true,
    onSuccess: (page: { flash?: { error?: string } }) => done?.(!page.flash?.error),
    onError: () => done?.(false),
  }
  if (method === 'delete') router.delete(url, options)
  else router[method](url, data ?? {}, options)
}

/** Base UI checkbox with the app's box styling. Use inside a <label> for the text. */
export function CheckBox({
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <Checkbox.Root
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      className={cn(
        'grid size-5 shrink-0 place-items-center rounded-[5px] border border-border-strong bg-surface text-primary-foreground outline-none',
        'data-checked:border-primary data-checked:bg-primary data-disabled:opacity-60',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className
      )}
    >
      <Checkbox.Indicator className="grid place-items-center data-unchecked:hidden">
        <Check size={14} strokeWidth={3} aria-hidden="true" />
      </Checkbox.Indicator>
    </Checkbox.Root>
  )
}
