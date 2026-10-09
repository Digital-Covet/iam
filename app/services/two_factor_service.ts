import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import encryption from '@adonisjs/core/services/encryption'
import db from '@adonisjs/lucid/services/db'
import type TwoFactor from '#models/two_factor'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const BACKUP_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Wrong codes allowed before a lockout starts. */
export const MAX_FAILURES = 5
const BASE_LOCK_MINUTES = 15
const MAX_LOCK_MINUTES = 24 * 60

type AttemptReservation = {
  allowed: boolean
  /** Set when locked, or when this guess started the lockout. */
  lockedUntil: DateTime | null
  /** Guesses left before the next lockout, counting this one as used. */
  remaining: number
}

export type SecondFactorResult =
  | { ok: true; method: 'totp' }
  | { ok: true; method: 'backup_code'; backupCodesRemaining: number }
  | {
      ok: false
      locked: boolean
      lockedUntil: DateTime | null
      remaining: number
      /** This wrong guess is the one that started the lockout. */
      startedLockout?: boolean
    }

function toDateTime(value: unknown): DateTime | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : DateTime.fromJSDate(date)
}

function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }
  return output
}

function base32Decode(input: string): Buffer {
  const clean = input
    .replace(/[\s-]+/g, '')
    .replace(/=+$/, '')
    .toUpperCase()
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index === -1) {
      throw new Error('Invalid base32 character')
    }
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

function hotp(secret: Buffer, counter: number, digits = 6): string {
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigUInt64BE(BigInt(counter))
  const hmac = createHmac('sha1', secret).update(counterBuffer).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return (code % 10 ** digits).toString().padStart(digits, '0')
}

export default class TwoFactorService {
  static generateSecret(byteLength = 20): string {
    return base32Encode(randomBytes(byteLength))
  }

  static otpauthUrl(email: string, secret: string, issuer = 'Digital Covet IAM'): string {
    const label = encodeURIComponent(`${issuer}:${email}`)
    const issuerParam = encodeURIComponent(issuer)
    return `otpauth://totp/${label}?secret=${secret}&issuer=${issuerParam}&algorithm=SHA1&digits=6&period=30`
  }

  static currentCode(secret: string, at = Date.now(), step = 30): string {
    const counter = Math.floor(at / 1000 / step)
    return hotp(base32Decode(secret), counter)
  }

  /**
   * Check a TOTP code against the current step ± `window`. Returns the time
   * step that matched, or null. Callers must still pass the step to
   * `acceptStep` so the same code can't be used twice.
   */
  static verifyCode(secret: string, code: string, at = Date.now(), window = 1): number | null {
    const normalized = code.replace(/[\s-]+/g, '')
    if (!/^\d{6}$/.test(normalized)) {
      return null
    }
    const key = base32Decode(secret)
    const counter = Math.floor(at / 1000 / 30)
    const expected = Buffer.from(normalized)
    let matched: number | null = null
    // Check every candidate (no early exit) so timing doesn't reveal the drift.
    for (let drift = -window; drift <= window; drift++) {
      const candidate = Buffer.from(hotp(key, counter + drift))
      if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) {
        matched ??= counter + drift
      }
    }
    return matched
  }

  /**
   * Record `step` as used, but only if it is newer than the last accepted one.
   * One atomic UPDATE, so two requests racing with the same code can't both
   * win. A success also clears the failure counter and any lockout.
   */
  static async acceptStep(twoFactorId: string, step: number): Promise<boolean> {
    const rows = await db
      .from('two_factor')
      .where('id', twoFactorId)
      .where((q) => q.whereNull('last_used_step').orWhere('last_used_step', '<', step))
      .update({
        last_used_step: step,
        failed_attempts: 0,
        locked_until: null,
        updated_at: new Date(),
      })
      .returning('id')
    return rows.length === 1
  }

  /**
   * Reserve one guess before checking a code. The counter is bumped in the
   * same statement that checks the lock, so parallel requests can't slip
   * extra guesses past it, and every 5th guess starts a lockout (15 min,
   * doubling, capped at 24 h). Returns `allowed: false` while locked.
   */
  static async reserveAttempt(twoFactorId: string): Promise<AttemptReservation> {
    const rows = await db.rawQuery(
      `update two_factor
         set failed_attempts = failed_attempts + 1,
             locked_until = case
               when (failed_attempts + 1) % ? = 0
                 then now() + make_interval(mins => cast(least(
                   ? * power(2, (failed_attempts + 1) / ? - 1), ?) as integer))
               else locked_until
             end,
             updated_at = now()
       where id = ? and (locked_until is null or locked_until <= now())
       returning failed_attempts, locked_until`,
      [MAX_FAILURES, BASE_LOCK_MINUTES, MAX_FAILURES, MAX_LOCK_MINUTES, twoFactorId]
    )
    const row = rows.rows?.[0]
    if (!row) {
      const current = await db
        .from('two_factor')
        .where('id', twoFactorId)
        .select('locked_until')
        .first()
      return { allowed: false, lockedUntil: toDateTime(current?.locked_until), remaining: 0 }
    }
    const used = Number(row.failed_attempts) % MAX_FAILURES
    return {
      allowed: true,
      // Set only when this guess was the one that started a lockout.
      lockedUntil: used === 0 ? toDateTime(row.locked_until) : null,
      remaining: used === 0 ? 0 : MAX_FAILURES - used,
    }
  }

  /** Guesses left before the next lockout, and the lockout end if one is active. */
  static lockState(twoFactor: { failedAttempts: number; lockedUntil: DateTime | null }) {
    const lockedUntil =
      twoFactor.lockedUntil && twoFactor.lockedUntil > DateTime.now() ? twoFactor.lockedUntil : null
    return {
      lockedUntil,
      remaining: lockedUntil ? 0 : MAX_FAILURES - (twoFactor.failedAttempts % MAX_FAILURES),
    }
  }

  /**
   * Check a TOTP or backup code for a signed-in or pending user: reserves a
   * guess, then verifies and consumes the code atomically. Used by sign-in and
   * by every step-up prompt, so they all share one lockout.
   */
  static async checkSecondFactor(
    twoFactor: TwoFactor,
    input: { code?: string | null; backupCode?: string | null }
  ): Promise<SecondFactorResult> {
    const attempt = await this.reserveAttempt(twoFactor.id)
    if (!attempt.allowed) {
      return { ok: false, locked: true, lockedUntil: attempt.lockedUntil, remaining: 0 }
    }
    const fail = (): SecondFactorResult => ({
      ok: false,
      locked: attempt.lockedUntil !== null,
      lockedUntil: attempt.lockedUntil,
      remaining: attempt.remaining,
      startedLockout: attempt.lockedUntil !== null,
    })

    const backupCode = input.backupCode?.trim()
    if (backupCode) {
      const hashed = await this.findBackupCode(twoFactor.backupCodesHashed, backupCode)
      const left = hashed ? await this.consumeBackupCode(twoFactor.id, hashed) : null
      if (left === null) return fail()
      return { ok: true, method: 'backup_code', backupCodesRemaining: left }
    }

    // Decrypt only here, so a bad key never blocks the backup-code path.
    const secret = this.decryptSecret(twoFactor.secretEncrypted)
    const step = input.code ? this.verifyCode(secret, input.code) : null
    if (step === null || !(await this.acceptStep(twoFactor.id, step))) return fail()
    return { ok: true, method: 'totp' }
  }

  static generateBackupCodes(count = 10): string[] {
    const codes: string[] = []
    for (let i = 0; i < count; i++) {
      const bytes = randomBytes(8)
      let code = ''
      for (const byte of bytes) {
        code += BACKUP_CODE_ALPHABET[byte % BACKUP_CODE_ALPHABET.length]
      }
      codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`)
    }
    return codes
  }

  static normalizeBackupCode(code: string): string {
    return code.replace(/[\s-]+/g, '').toUpperCase()
  }

  static async hashBackupCodes(codes: string[]): Promise<string[]> {
    return Promise.all(codes.map((code) => hash.make(TwoFactorService.normalizeBackupCode(code))))
  }

  /** The stored hash that matches `code`, or null. */
  static async findBackupCode(hashed: string[], code: string): Promise<string | null> {
    const normalized = TwoFactorService.normalizeBackupCode(code)
    for (const element of hashed) {
      if (await hash.verify(element, normalized)) {
        return element
      }
    }
    return null
  }

  /**
   * Remove one backup code in a single UPDATE that only matches while the
   * code is still present, so a code works exactly once even under parallel
   * requests. Returns how many codes are left, or null if it was already used.
   */
  static async consumeBackupCode(twoFactorId: string, hashed: string): Promise<number | null> {
    const rows = await db
      .from('two_factor')
      .where('id', twoFactorId)
      .whereRaw('? = any(backup_codes_hashed)', [hashed])
      .update({
        backup_codes_hashed: db.raw('array_remove(backup_codes_hashed, ?)', [hashed]),
        failed_attempts: 0,
        locked_until: null,
        updated_at: new Date(),
      })
      .returning('backup_codes_hashed')
    if (rows.length !== 1) return null
    return (rows[0].backup_codes_hashed as string[] | null)?.length ?? 0
  }

  static encryptSecret(secret: string): string {
    return encryption.encrypt(secret)
  }

  static decryptSecret(encrypted: string): string {
    const decrypted = encryption.decrypt<string>(encrypted)
    if (typeof decrypted !== 'string' || !decrypted) {
      throw new Error('Invalid two-factor secret')
    }
    return decrypted
  }

  static formatSecretGroups(secret: string): string {
    return secret.replace(/(.{4})/g, '$1 ').trim()
  }
}
