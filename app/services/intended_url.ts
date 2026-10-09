import type { Session } from '@adonisjs/session'

/**
 * Where to send a user right after sign-in. `/oauth/authorize` stashes the
 * pending request in `intended_url`; only that server-set path is honoured,
 * so this can never become an open redirect.
 */
export function postLoginPath(session: Session): string {
  const intended = session.pull('intended_url') as string | undefined
  return intended && intended.startsWith('/oauth/authorize?') ? intended : '/dashboard'
}
