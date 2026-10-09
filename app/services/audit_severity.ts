export const AUDIT_SEVERITIES = ['info', 'notice', 'critical'] as const
export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number]

/** Successful actions that change who can do what, or touch credentials. */
export const SENSITIVE_ACTION =
  /role|permission|entitlement|grant|revoke|suspend|delete|violation|policy|secret|token/i

/**
 * Default severity for an event: anything that did not succeed is critical,
 * sensitive successes are notices, the rest is routine. Call sites may pass an
 * explicit `severity` to override this.
 */
export function deriveSeverity(status: string, action: string): AuditSeverity {
  if (status !== 'success') return 'critical'
  return SENSITIVE_ACTION.test(action) ? 'notice' : 'info'
}

const SECRET_KEY = /token|secret|password|passwd|code|authorization|cookie|credential|otp|totp|key/i

/** Replace the value of any secret-looking key, at any depth. Never mutates the input. */
export function redactSecrets(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[truncated]'
  if (Array.isArray(value)) return value.map((v) => redactSecrets(v, depth + 1))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SECRET_KEY.test(k) ? '[redacted]' : redactSecrets(v, depth + 1),
      ])
    )
  }
  return value
}
