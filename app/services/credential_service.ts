import hash from '@adonisjs/core/services/hash'
import { Exception } from '@adonisjs/core/exceptions'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Account from '#models/account'
import type User from '#models/user'

/**
 * Better Auth stores credentials as an `account` row with
 * `provider_id = 'credential'` and the password hash in `password_hash`.
 */
export const CREDENTIAL_PROVIDER = 'credential'

/**
 * A lazily generated valid hash used to keep login response times
 * constant when no matching account exists (timing-attack mitigation).
 */
let dummyHash: Promise<string> | null = null
function getDummyHash() {
  dummyHash ??= hash.make('iam-digital-covet::invalid-credential')
  return dummyHash
}

export default class CredentialService {
  /**
   * Create the credential account row for a freshly registered user.
   */
  static async createAccount(
    user: User,
    password: string,
    client?: TransactionClientContract
  ): Promise<Account> {
    return Account.create(
      {
        userId: user.id,
        accountId: user.id,
        providerId: CREDENTIAL_PROVIDER,
        passwordHash: await hash.make(password),
      },
      client ? { client } : undefined
    )
  }

  /**
   * Resolve a user by email + password. Throws E_INVALID_CREDENTIALS
   * when the account is missing or the password is wrong, and
   * E_ACCOUNT_SUSPENDED (with `userId` and `reason`) when the password is right
   * but the account is suspended.
   */
  static async verify(email: string, password: string): Promise<User> {
    const account = await Account.query()
      .where('provider_id', CREDENTIAL_PROVIDER)
      .whereHas('user', (query) => {
        query.where('email', email).whereNull('deleted_at')
      })
      .preload('user')
      .first()

    if (!account?.passwordHash) {
      await hash.verify(await getDummyHash(), password)
      throw new Exception('Invalid credentials', {
        status: 400,
        code: 'E_INVALID_CREDENTIALS',
      })
    }

    const isValid = await hash.verify(account.passwordHash, password)
    if (!isValid) {
      throw new Exception('Invalid credentials', {
        status: 400,
        code: 'E_INVALID_CREDENTIALS',
      })
    }

    // Only reveal the suspension once the password is right, so this can't be
    // used to probe which emails exist.
    if (account.user.bannedAt) {
      throw Object.assign(
        new Exception('Account suspended', { status: 403, code: 'E_ACCOUNT_SUSPENDED' }),
        {
          userId: account.user.id,
          reason: account.user.banReason,
        }
      )
    }

    return account.user
  }
}
