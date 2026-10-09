import type { Session } from '@adonisjs/session'

const USER_KEY = 'two_factor_pending_user_id'
const STARTED_KEY = 'two_factor_pending_at'
const NEXT_KEY = 'two_factor_next'

/** How long a correct password keeps the 2FA prompt open. */
const TTL_MS = 5 * 60 * 1000

/** What happens after the second factor passes. */
export type ChallengeNext = 'login' | 'password_reset'

export type Challenge = { userId: string; next: ChallengeNext }

/**
 * The password step's hand-off to /verify-2fa. Only the user id and a
 * timestamp live in the session; attempt counting is in the `two_factor` row,
 * so replaying an old session cookie or signing in again gains nothing.
 */
export function startChallenge(session: Session, userId: string, next: ChallengeNext) {
  session.put(USER_KEY, userId)
  session.put(STARTED_KEY, Date.now())
  session.put(NEXT_KEY, next)
}

/** The live challenge, or null when there is none or it has expired. */
export function readChallenge(session: Session): Challenge | null {
  const userId = session.get(USER_KEY) as string | undefined
  const startedAt = Number(session.get(STARTED_KEY) ?? 0)
  if (!userId || !startedAt || Date.now() - startedAt > TTL_MS) return null
  const next: ChallengeNext = session.get(NEXT_KEY) === 'password_reset' ? 'password_reset' : 'login'
  return { userId, next }
}

/** True when a challenge was started but has run out of time. */
export function challengeExpired(session: Session): boolean {
  return Boolean(session.get(USER_KEY)) && readChallenge(session) === null
}

export function clearChallenge(session: Session) {
  session.forget(USER_KEY)
  session.forget(STARTED_KEY)
  session.forget(NEXT_KEY)
  // Left over from sessions started before attempt counting moved server-side.
  session.forget('two_factor_attempts_remaining')
}
