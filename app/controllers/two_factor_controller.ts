import { DateTime } from 'luxon'
import QRCode from 'qrcode'
import TwoFactor from '#models/two_factor'
import User from '#models/user'
import CredentialService from '#services/credential_service'
import { redirectToPasswordReset } from '#services/expired_password'
import { postLoginPath } from '#services/intended_url'
import MailService from '#services/mail_service'
import SessionTracker from '#services/session_tracker'
import { PASSWORD_AND_OTP, rememberSignIn } from '#services/sign_in_context'
import {
  challengeExpired,
  clearChallenge,
  readChallenge,
  startChallenge,
} from '#services/two_factor_challenge'
import { twoFactorRequired } from '#services/two_factor_policy'
import TwoFactorService, { MAX_FAILURES } from '#services/two_factor_service'
import {
  disableValidator,
  regenerateValidator,
  setupConfirmValidator,
  verifyBackupCodeValidator,
  verifyTotpValidator,
} from '#validators/two_factor'
import type { HttpContext } from '@adonisjs/core/http'

const SETUP_SESSION_KEY = 'two_factor_setup_secret'

function lockMessage(lockedUntil: unknown): string {
  const iso =
    lockedUntil instanceof DateTime
      ? lockedUntil.toUTC().toFormat('HH:mm')
      : lockedUntil instanceof Date
        ? lockedUntil.toISOString().slice(11, 16)
        : null
  return iso
    ? `Too many wrong codes. Try again after ${iso} UTC.`
    : 'Too many wrong codes. Try again later.'
}

export default class TwoFactorController {
  /**
   * GET /verify-2fa — TOTP challenge after password login.
   * Only the user id + timestamp live in the session; counting is server-side.
   */
  async showVerify({ inertia, session, response }: HttpContext) {
    const challenge = readChallenge(session)
    if (!challenge) {
      if (challengeExpired(session)) {
        clearChallenge(session)
        session.flash('error', 'Your sign-in expired. Enter your password again.')
      }
      return response.redirect().toRoute('session.create')
    }

    const user = await User.query()
      .where('id', challenge.userId)
      .whereNull('deleted_at')
      .whereNull('banned_at')
      .preload('twoFactor')
      .first()
    if (!user?.twoFactor?.enabled) {
      clearChallenge(session)
      return response.redirect().toRoute('session.create')
    }

    const { lockedUntil, remaining } = TwoFactorService.lockState(user.twoFactor)
    return inertia.render('auth/verify_2fa', {
      attemptsRemaining: remaining,
      lockedUntil: lockedUntil?.toISO() ?? null,
      backupCodesRemaining: user.twoFactor.backupCodesHashed.length,
    })
  }

  /**
   * POST /verify-2fa — verify TOTP or backup code, then complete login
   * (or continue to a password reset when the password had expired).
   */
  async storeVerify(ctx: HttpContext) {
    const { request, auth, session, response } = ctx
    const challenge = readChallenge(session)
    if (!challenge) {
      if (challengeExpired(session)) {
        clearChallenge(session)
        session.flash('error', 'Your sign-in expired. Enter your password again.')
      }
      return response.redirect().toRoute('session.create')
    }

    const user = await User.query()
      .where('id', challenge.userId)
      .whereNull('deleted_at')
      .whereNull('banned_at')
      .preload('twoFactor')
      .first()

    if (!user?.twoFactor?.enabled) {
      clearChallenge(session)
      return response.redirect().toRoute('session.create')
    }

    const body = request.body()
    const useBackup = typeof body.backupCode === 'string' && body.backupCode.trim() !== ''
    const input = useBackup
      ? await request.validateUsing(verifyBackupCodeValidator)
      : await request.validateUsing(verifyTotpValidator)

    const payload = useBackup
      ? { backupCode: (input as { backupCode: string }).backupCode }
      : { code: (input as { code: string }).code }

    const result = await TwoFactorService.checkSecondFactor(user.twoFactor, payload)

    if (!result.ok) {
      await SessionTracker.audit(ctx, {
        action: 'auth.2fa_failed',
        actorId: user.id,
        status: 'failure',
        metadata: { method: useBackup ? 'backup_code' : 'totp', remaining: result.remaining },
      })
      if (result.locked || result.startedLockout) {
        await SessionTracker.audit(ctx, {
          action: 'auth.2fa_locked',
          actorId: user.id,
          status: 'failure',
          metadata: {
            lockedUntil: result.lockedUntil?.toISO() ?? null,
          },
        })
        await MailService.notifyTwoFactor(user.email, 'locked', {
          lockedUntil: result.lockedUntil?.toUTC().toFormat('HH:mm') ?? undefined,
        })
        session.flash('error', lockMessage(result.lockedUntil))
        return response.redirect().back()
      }
      session.flash(
        'error',
        result.remaining > 0
          ? `That ${useBackup ? 'backup code' : 'code'} didn't match. ${result.remaining} ${result.remaining === 1 ? 'attempt' : 'attempts'} remaining.`
          : 'Too many attempts. Start sign-in again.'
      )
      if (result.remaining <= 0) {
        clearChallenge(session)
        return response.redirect().toRoute('session.create')
      }
      return response.redirect().back()
    }

    // Success clears failures + lockout inside the atomic UPDATE above.
    if (challenge.next === 'password_reset') {
      clearChallenge(session)
      return redirectToPasswordReset(ctx, user.id)
    }

    await auth.use('web').login(user)
    await SessionTracker.recordLogin(
      ctx,
      user,
      result.method === 'backup_code' ? 'password+backup_code' : 'password+totp'
    )
    rememberSignIn(session, PASSWORD_AND_OTP)
    clearChallenge(session)

    if (result.method === 'backup_code') {
      await SessionTracker.audit(ctx, {
        action: 'auth.2fa_backup_code_used',
        actorId: user.id,
        status: 'success',
        metadata: { backupCodesRemaining: result.backupCodesRemaining },
      })
      await MailService.notifyTwoFactor(user.email, 'backup_code_used', {
        backupCodesRemaining: result.backupCodesRemaining,
      })
    }

    return response.redirect(postLoginPath(session))
  }

  /**
   * GET /setup-2fa — 3-step enrollment (QR + secret → verify → backup codes).
   * Authenticated users only. If already enabled, show status instead of
   * re-enrolling silently.
   */
  async createSetup({ inertia, auth, session }: HttpContext) {
    const user = auth.user!
    await user.load('twoFactor')

    if (user.twoFactor?.enabled) {
      return inertia.render('auth/setup_2fa', {
        alreadyEnabled: true,
        email: user.email,
      })
    }

    let secret = session.get(SETUP_SESSION_KEY) as string | undefined
    if (!secret) {
      secret = TwoFactorService.generateSecret()
      session.put(SETUP_SESSION_KEY, secret)
    }

    const otpauthUrl = TwoFactorService.otpauthUrl(user.email, secret)
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 200 })

    inertia.encryptHistory()
    return inertia.render('auth/setup_2fa', {
      alreadyEnabled: false,
      email: user.email,
      secret,
      secretGroups: TwoFactorService.formatSecretGroups(secret),
      otpauthUrl,
      qrDataUrl,
    })
  }

  /**
   * POST /setup-2fa — confirm TOTP + current password, persist secret +
   * backup codes, show codes once. Revokes every other session so enrollment
   * can't be silently piggy-backed.
   */
  async storeSetup(ctx: HttpContext) {
    const { request, auth, session, response, inertia } = ctx
    const user = auth.user!
    await user.load('twoFactor')

    if (user.twoFactor?.enabled) {
      session.flash('error', 'Two-factor is already enabled for this account.')
      return response.redirect().back()
    }

    const secret = session.get(SETUP_SESSION_KEY) as string | undefined
    if (!secret) {
      session.flash('error', 'Your setup session expired. Start again.')
      return response.redirect().back()
    }

    const { code, currentPassword } = await request.validateUsing(setupConfirmValidator)
    try {
      await CredentialService.verify(user.email, currentPassword)
    } catch {
      session.flash('error', 'Your current password is wrong. Try again.')
      return response.redirect().back()
    }

    const step = TwoFactorService.verifyCode(secret, code)
    if (step === null) {
      await SessionTracker.audit(ctx, {
        action: 'auth.2fa_failed',
        actorId: user.id,
        status: 'failure',
        metadata: { method: 'totp', stage: 'enroll' },
      })
      session.flash('error', "That code didn't match. Check your authenticator app and try again.")
      return response.redirect().back()
    }

    const backupCodes = TwoFactorService.generateBackupCodes(10)
    const backupCodesHashed = await TwoFactorService.hashBackupCodes(backupCodes)

    await TwoFactor.updateOrCreate(
      { userId: user.id },
      {
        userId: user.id,
        secretEncrypted: TwoFactorService.encryptSecret(secret),
        backupCodesHashed,
        enabled: true,
        verifiedAt: DateTime.now(),
        failedAttempts: 0,
        lockedUntil: null,
        lastUsedStep: step,
      }
    )

    await SessionTracker.audit(ctx, {
      action: 'auth.2fa_enabled',
      actorId: user.id,
      status: 'success',
    })
    await MailService.notifyTwoFactor(user.email, 'enabled')
    await SessionTracker.revokeAll(user.id, SessionTracker.tokenOf(ctx))

    session.forget(SETUP_SESSION_KEY)
    session.flash('success', 'Two-factor authentication is enabled.')

    inertia.encryptHistory()
    return inertia.render('auth/setup_2fa', {
      alreadyEnabled: false,
      email: user.email,
      confirmed: true,
      backupCodes,
    })
  }

  /**
   * POST /setup-2fa/regenerate — rotate backup codes. Requires a current
   * TOTP code (step-up) so a stolen session alone can't mint persistence.
   */
  async regenerateBackupCodes(ctx: HttpContext) {
    const { request, auth, session, response, inertia } = ctx
    const user = auth.user!
    await user.load('twoFactor')

    if (!user.twoFactor?.enabled) {
      session.flash('error', 'Enable two-factor first, then regenerate backup codes.')
      return response.redirect().back()
    }

    const { code } = await request.validateUsing(regenerateValidator)
    const result = await TwoFactorService.checkSecondFactor(user.twoFactor, { code })
    if (!result.ok || result.method !== 'totp') {
      if (!result.ok && (result.locked || result.startedLockout)) {
        await SessionTracker.audit(ctx, {
          action: 'auth.2fa_locked',
          actorId: user.id,
          status: 'failure',
          metadata: { stage: 'regenerate' },
        })
        session.flash('error', lockMessage(result.lockedUntil))
        return response.redirect().back()
      }
      await SessionTracker.audit(ctx, {
        action: 'auth.2fa_failed',
        actorId: user.id,
        status: 'failure',
        metadata: { method: 'totp', stage: 'regenerate' },
      })
      session.flash('error', "That code didn't match. Check your authenticator app and try again.")
      return response.redirect().back()
    }

    const backupCodes = TwoFactorService.generateBackupCodes(10)
    user.twoFactor.backupCodesHashed = await TwoFactorService.hashBackupCodes(backupCodes)
    await user.twoFactor.save()

    await SessionTracker.audit(ctx, {
      action: 'auth.2fa_backup_codes_regenerated',
      actorId: user.id,
      status: 'success',
    })
    await MailService.notifyTwoFactor(user.email, 'backup_codes_regenerated')

    session.flash('success', 'New backup codes generated. Old codes no longer work.')

    inertia.encryptHistory()
    return inertia.render('auth/setup_2fa', {
      alreadyEnabled: false,
      email: user.email,
      confirmed: true,
      backupCodes,
      regenerated: true,
    })
  }

  /**
   * POST /setup-2fa/disable — turn 2FA off. Requires the current password
   * plus a TOTP or backup code. Blocked while the org requires 2FA.
   */
  async disable(ctx: HttpContext) {
    const { request, auth, session, response } = ctx
    const user = auth.user!
    await user.load('twoFactor')

    if (!user.twoFactor?.enabled) {
      return response.redirect().toRoute('two_factor.createSetup')
    }

    if (await twoFactorRequired()) {
      session.flash('error', 'Your organization requires two-factor. It cannot be turned off.')
      return response.redirect().back()
    }

    const { currentPassword, code, backupCode } = await request.validateUsing(disableValidator)
    try {
      await CredentialService.verify(user.email, currentPassword)
    } catch {
      session.flash('error', 'Your current password is wrong. Try again.')
      return response.redirect().back()
    }

    const second = backupCode?.trim() ? { backupCode: backupCode! } : code ? { code: code! } : null
    if (!second) {
      session.flash('error', 'Enter a code from your authenticator app or a backup code.')
      return response.redirect().back()
    }

    const result = await TwoFactorService.checkSecondFactor(user.twoFactor, second)
    if (!result.ok) {
      await SessionTracker.audit(ctx, {
        action: 'auth.2fa_failed',
        actorId: user.id,
        status: 'failure',
        metadata: { stage: 'disable' },
      })
      session.flash('error', "That second factor didn't match. Try again.")
      return response.redirect().back()
    }

    await user.twoFactor.delete()
    await SessionTracker.audit(ctx, {
      action: 'auth.2fa_disabled',
      actorId: user.id,
      status: 'success',
    })
    await MailService.notifyTwoFactor(user.email, 'disabled')
    await SessionTracker.revokeAll(user.id, SessionTracker.tokenOf(ctx))

    session.flash('success', 'Two-factor is off. Your password alone now signs you in.')
    return response.redirect().toRoute('account.index')
  }

  /** Re-export for tests: attempt budget shown in the UI. */
  static maxAttempts() {
    return MAX_FAILURES
  }
}

/** Keep password-reset continuation working when called from older sessions. */
export function keepChallengeAlive(session: HttpContext['session'], userId: string) {
  startChallenge(session, userId, 'login')
}
