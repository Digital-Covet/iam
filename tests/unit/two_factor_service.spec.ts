import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import TwoFactorService, { MAX_FAILURES } from '#services/two_factor_service'

test.group('TwoFactorService | totp', () => {
  test('currentCode verifies at the same instant and returns its step', ({ assert }) => {
    const secret = TwoFactorService.generateSecret()
    const at = Date.now()
    const code = TwoFactorService.currentCode(secret, at)
    const step = TwoFactorService.verifyCode(secret, code, at)
    assert.isNumber(step)
    assert.equal(step, Math.floor(at / 1000 / 30))
  })

  test('codes from one step away verify inside the default window', ({ assert }) => {
    const secret = TwoFactorService.generateSecret()
    const at = Date.now()
    const prev = TwoFactorService.currentCode(secret, at - 30_000)
    const next = TwoFactorService.currentCode(secret, at + 30_000)
    assert.isNumber(TwoFactorService.verifyCode(secret, prev, at))
    assert.isNumber(TwoFactorService.verifyCode(secret, next, at))
  })

  test('codes two steps away are rejected', ({ assert }) => {
    const secret = TwoFactorService.generateSecret()
    const at = Date.now()
    const far = TwoFactorService.currentCode(secret, at - 90_000)
    assert.isNull(TwoFactorService.verifyCode(secret, far, at))
  })

  test('malformed codes are rejected without throwing', ({ assert }) => {
    const secret = TwoFactorService.generateSecret()
    for (const bad of ['', '12345', '1234567', 'abcdef', '12 34 5a']) {
      assert.isNull(TwoFactorService.verifyCode(secret, bad))
    }
  })

  test('spaces and dashes are accepted like the UI sends them', ({ assert }) => {
    const secret = TwoFactorService.generateSecret()
    const at = Date.now()
    const code = TwoFactorService.currentCode(secret, at)
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`
    assert.isNumber(TwoFactorService.verifyCode(secret, spaced, at))
  })

  test('generated secrets are 160 bits of entropy', ({ assert }) => {
    const secret = TwoFactorService.generateSecret()
    // 20 bytes -> 32 base32 chars, from the OS random source.
    assert.equal(secret.length, 32)
    assert.match(secret, /^[A-Z2-7]+$/)
    assert.notEqual(secret, TwoFactorService.generateSecret())
  })
})

test.group('TwoFactorService | lockState', () => {
  test('fresh record allows a full budget of guesses', ({ assert }) => {
    const state = TwoFactorService.lockState({ failedAttempts: 0, lockedUntil: null })
    assert.isNull(state.lockedUntil)
    assert.equal(state.remaining, MAX_FAILURES)
  })

  test('remaining counts down within a cycle', ({ assert }) => {
    const state = TwoFactorService.lockState({ failedAttempts: 3, lockedUntil: null })
    assert.equal(state.remaining, MAX_FAILURES - 3)
  })

  test('an active lockout reports zero remaining', ({ assert }) => {
    const state = TwoFactorService.lockState({
      failedAttempts: 5,
      lockedUntil: DateTime.now().plus({ minutes: 15 }),
    })
    assert.isNotNull(state.lockedUntil)
    assert.equal(state.remaining, 0)
  })

  test('an expired lockout is treated as unlocked', ({ assert }) => {
    const state = TwoFactorService.lockState({
      failedAttempts: 5,
      lockedUntil: DateTime.now().minus({ minutes: 1 }),
    })
    assert.isNull(state.lockedUntil)
  })
})

test.group('TwoFactorService | backup codes', () => {
  test('generated codes are unbiased 8-char pairs', ({ assert }) => {
    const codes = TwoFactorService.generateBackupCodes(10)
    assert.equal(codes.length, 10)
    assert.equal(new Set(codes).size, 10)
    for (const code of codes) {
      assert.match(
        code,
        /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/
      )
    }
  })

  test('normalization is case/space/dash insensitive', ({ assert }) => {
    assert.equal(TwoFactorService.normalizeBackupCode('abcd-ef12'), 'ABCDEF12')
    assert.equal(TwoFactorService.normalizeBackupCode(' ab cd '), 'ABCD')
  })
})
