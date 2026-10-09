import hash from '@adonisjs/core/services/hash'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Account from '#models/account'
import PasswordHistory from '#models/password_history'
import PasswordPolicy from '#models/password_policy'
import { CREDENTIAL_PROVIDER } from '#services/credential_service'

/** Matches the policy form's maximum, so raising the setting later has data. */
const HISTORY_KEEP = 24

export type PasswordExpiry = {
  /** When the current password stops working; null if expiry is off. */
  expiresAt: DateTime | null
  expired: boolean
}

/**
 * Password expiry and reuse rules from the `password_policy` row. The length
 * and complexity rules stay in password_policy_service.
 */
export default class PasswordService {
  /** Expiry state for a user's credential account against the live policy. */
  static async expiryFor(userId: string): Promise<PasswordExpiry> {
    const policy = await PasswordPolicy.query().first()
    if (!policy?.maxAgeDays) return { expiresAt: null, expired: false }

    const account = await Account.query()
      .where('user_id', userId)
      .where('provider_id', CREDENTIAL_PROVIDER)
      .first()
    if (!account) return { expiresAt: null, expired: false }

    const expiresAt = account.passwordChangedAt.plus({ days: policy.maxAgeDays })
    return { expiresAt, expired: expiresAt <= DateTime.now() }
  }

  /**
   * Refuse a password the person already uses or recently used. "Last N" counts
   * the current password, so N = 1 only blocks re-entering the same one.
   */
  static async reuseError(
    account: Account,
    newPassword: string,
    policy: PasswordPolicy | null
  ): Promise<string | null> {
    const remembered = policy?.historyCount ?? 0
    if (remembered <= 0 || !account.passwordHash) return null

    const hashes = [account.passwordHash]
    if (remembered > 1) {
      const retired = await PasswordHistory.query()
        .where('user_id', account.userId)
        .orderBy('created_at', 'desc')
        .limit(remembered - 1)
      hashes.push(...retired.map((row) => row.passwordHash))
    }

    for (const stored of hashes) {
      if (await hash.verify(stored, newPassword)) {
        return remembered === 1
          ? 'Choose a password different from your current one.'
          : `You used that password recently. Choose one you haven't used in your last ${remembered}.`
      }
    }
    return null
  }

  /**
   * Replace the password: retire the old hash into history, store the new
   * one, and restart the expiry clock.
   */
  static async setPassword(account: Account, newPassword: string) {
    const newHash = await hash.make(newPassword)

    await db.transaction(async (trx) => {
      if (account.passwordHash) {
        await PasswordHistory.create(
          { userId: account.userId, passwordHash: account.passwordHash },
          { client: trx }
        )
      }

      account.useTransaction(trx)
      account.passwordHash = newHash
      account.passwordChangedAt = DateTime.now()
      await account.save()

      const keep = await PasswordHistory.query({ client: trx })
        .where('user_id', account.userId)
        .orderBy('created_at', 'desc')
        .limit(HISTORY_KEEP)
      await PasswordHistory.query({ client: trx })
        .where('user_id', account.userId)
        .whereNotIn(
          'id',
          keep.map((row) => row.id)
        )
        .delete()
    })
  }
}
