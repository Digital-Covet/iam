import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Role from '#models/role'
import User from '#models/user'
import TwoFactor from '#models/two_factor'
import TwoFactorService from '#services/two_factor_service'

/**
 * DB-backed 2FA guarantees (H1/H2/M1): the failure counter survives a fresh
 * password login, a TOTP step cannot be accepted twice, and a backup code is
 * consumed exactly once — even when two requests race.
 */
test.group('TwoFactor hardening', (group) => {
  let roleId: string
  group.each.setup(async () => {
    await testUtils.db().truncate()
    const role = await Role.firstOrCreate(
      { name: 'spec-employee' },
      { description: 'functional spec role', isSystem: false }
    )
    roleId = role.id
  })
  group.each.teardown(() => testUtils.db().truncate())

  async function specUser(n: number) {
    return User.create({
      email: `2fa-spec-${n}-${Date.now()}@example.com`,
      name: '2FA Spec',
      roleId,
      emailVerified: true,
    })
  }

  test('five failures lock the row and a fresh reader still sees the lock', async ({ assert }) => {
    const user = await specUser(1)
    const row = await TwoFactor.create({
      userId: user.id,
      secretEncrypted: TwoFactorService.encryptSecret(TwoFactorService.generateSecret()),
      backupCodesHashed: [],
      enabled: true,
    })

    for (let i = 0; i < 5; i++) {
      const attempt = await TwoFactorService.reserveAttempt(row.id)
      assert.isTrue(attempt.allowed)
    }
    const locked = await TwoFactorService.reserveAttempt(row.id)
    assert.isFalse(locked.allowed)
    assert.isNotNull(locked.lockedUntil)

    // A fresh read (as a new /login would do) still sees the lockout.
    const fresh = await TwoFactor.findOrFail(row.id)
    const state = TwoFactorService.lockState(fresh)
    assert.isNotNull(state.lockedUntil)
    assert.equal(state.remaining, 0)

    await row.delete()
  })

  test('a TOTP step is accepted once; replay in the same window fails', async ({ assert }) => {
    const secret = TwoFactorService.generateSecret()
    const user = await specUser(2)
    const row = await TwoFactor.create({
      userId: user.id,
      secretEncrypted: TwoFactorService.encryptSecret(secret),
      backupCodesHashed: [],
      enabled: true,
    })

    const code = TwoFactorService.currentCode(secret)
    const step = TwoFactorService.verifyCode(secret, code)
    assert.isNumber(step)

    assert.isTrue(await TwoFactorService.acceptStep(row.id, step!))
    // Same code again in the same 30s window must not verify a second login.
    assert.isFalse(await TwoFactorService.acceptStep(row.id, step!))

    await row.delete()
  })

  test('parallel use of one backup code lets exactly one request in', async ({ assert }) => {
    const plaintext = TwoFactorService.generateBackupCodes(1)[0]
    const user = await specUser(3)
    const row = await TwoFactor.create({
      userId: user.id,
      secretEncrypted: TwoFactorService.encryptSecret(TwoFactorService.generateSecret()),
      backupCodesHashed: await TwoFactorService.hashBackupCodes([plaintext]),
      enabled: true,
    })

    const fresh = await TwoFactor.findOrFail(row.id)
    const hashed = await TwoFactorService.findBackupCode(fresh.backupCodesHashed, plaintext)
    assert.isNotNull(hashed)

    const [first, second] = await Promise.all([
      TwoFactorService.consumeBackupCode(row.id, hashed!),
      TwoFactorService.consumeBackupCode(row.id, hashed!),
    ])
    const wins = [first, second].filter((r) => r !== null)
    assert.equal(wins.length, 1)

    await row.delete()
  })
})
