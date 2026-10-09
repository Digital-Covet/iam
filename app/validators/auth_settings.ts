import vine from '@vinejs/vine'

/**
 * Auth settings — `/auth-settings` · Utility · SETTINGS nav (admin only).
 * Password policy edits land here; the account-settings checklist reads
 * the same row. Method toggles are per-key PATCH calls.
 */
export const policyValidator = vine.create({
  minLength: vine.number().min(8).max(64),
  requireUppercase: vine.boolean(),
  requireLowercase: vine.boolean(),
  requireNumber: vine.boolean(),
  requireSpecial: vine.boolean(),
  maxAgeDays: vine.number().min(30).max(3650).nullable(),
  historyCount: vine.number().min(0).max(24),
  requireTwoFactor: vine.boolean().optional(),
})

export const methodValidator = vine.create({
  enabled: vine.boolean(),
})
