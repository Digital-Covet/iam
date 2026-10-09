import type { Session } from '@adonisjs/session'

const KEY = 'sign_in_context'

/** Authentication method references (RFC 8176) recorded at sign-in. */
export type Amr = 'pwd' | 'otp' | 'mfa'

export type SignInContext = { authTime: number; amr: Amr[] }

export const PASSWORD_ONLY: Amr[] = ['pwd']
export const PASSWORD_AND_OTP: Amr[] = ['pwd', 'otp', 'mfa']

/**
 * Remember when and how this browser signed in, right after `auth.login()`.
 * Consent copies it onto the authorization code so the ID token carries the
 * real `auth_time` and `amr`.
 */
export function rememberSignIn(session: Session, amr: Amr[]) {
  session.put(KEY, { authTime: Math.floor(Date.now() / 1000), amr } satisfies SignInContext)
}

/** Null for sessions that signed in before this was recorded. */
export function signInContext(session: Session): SignInContext | null {
  const value = session.get(KEY) as SignInContext | undefined
  if (!value || typeof value.authTime !== 'number' || !Array.isArray(value.amr)) return null
  return value
}
