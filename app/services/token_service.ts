import { createHash, randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import Verification from '#models/verification'

export type TokenKind = 'invite' | 'reset'

const TTL: Record<TokenKind, { days?: number; hours?: number }> = {
  invite: { days: 7 },
  reset: { hours: 1 },
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')

/**
 * One-time tokens kept in the `verification` table. Only the SHA-256 of the
 * token is stored (`value`); `identifier` is `<kind>:<userId>`.
 */
export default class TokenService {
  /** Issue a token, replacing any outstanding one of the same kind. */
  static async issue(userId: string, kind: TokenKind): Promise<string> {
    const identifier = `${kind}:${userId}`
    await Verification.query().where('identifier', identifier).delete()

    const token = randomBytes(32).toString('base64url')
    await Verification.create({
      userId,
      identifier,
      value: sha256(token),
      expiresAt: DateTime.now().plus(TTL[kind]),
    })
    return token
  }

  /** Look up a live token of either kind. Returns null if unknown or expired. */
  static async find(token: string): Promise<{ row: Verification; kind: TokenKind } | null> {
    const row = await Verification.query()
      .where('value', sha256(token))
      .where('expires_at', '>', DateTime.now().toSQL()!)
      .first()
    if (!row || !row.userId) return null
    const kind = row.identifier.split(':')[0]
    if (kind !== 'invite' && kind !== 'reset') return null
    return { row, kind }
  }

  static async consume(row: Verification) {
    await row.delete()
  }
}
