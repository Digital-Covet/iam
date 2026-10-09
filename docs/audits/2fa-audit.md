# Two-factor authentication audit

**Date:** 2026-10-09
**Scope:** every path that ends in `auth.use('web').login()`, plus enrolment, backup codes, and the OIDC tokens issued after sign-in.

Files reviewed:
- `app/services/two_factor_service.ts`
- `app/controllers/two_factor_controller.ts`
- `app/controllers/session_controller.ts`
- `app/controllers/new_account_controller.ts`
- `app/controllers/password_controller.ts`
- `app/controllers/oauth_controller.ts`
- `app/controllers/consent_controller.ts`
- `app/services/oauth_service.ts`
- `app/models/two_factor.ts`
- `app/validators/two_factor.ts`
- `database/migrations/1762000009000_create_two_factor_table.ts`
- `start/routes.ts`
- `config/{session,auth,hash,encryption,shield}.ts`
- `inertia/pages/auth/{verify_2fa,setup_2fa}.tsx`

## Summary

The cryptography is sound. The weaknesses are in how state is kept and limited:
- The attempt limit could be bypassed, so TOTP codes could be brute-forced.
- A TOTP code could be accepted more than once.
- Two requests at the same moment could both use one backup code.
- A password-only attacker could reset the password of an account protected by 2FA.

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| H1 | High | TOTP attempt limit can be bypassed (brute force) | Fixed |
| H2 | High | TOTP code can be replayed | Fixed |
| M1 | Medium | Backup code can be used twice by parallel requests | Fixed |
| M2 | Medium | Expired-password path skips 2FA | Fixed |
| M3 | Medium | No re-confirmation for sensitive 2FA actions | Fixed |
| M4 | Medium | Pending 2FA state never expires | Fixed |
| L1 | Low | Secret and backup codes kept in browser history | Fixed |
| L2 | Low | Backup codes stop working if the secret can't be decrypted | Fixed |
| L3 | Low | Backup-code checks are expensive enough to load the CPU | Mitigated (rate limits) |
| L4 | Low | OIDC tokens don't show that 2FA happened | Fixed |
| L5 | Low | Gaps in audit events and email notices | Fixed |
| L6 | Low | No tests | Fixed |
| F1 | Gap | No way for users to turn 2FA off | Added |
| F2 | Gap | No admin reset for a lost device | Added |
| F3 | Gap | No org-wide "require 2FA" policy | Added |

---

## High

### H1. TOTP attempt limit can be bypassed (brute force)
`two_factor_controller.ts` (storeVerify), `session_controller.ts:41-42`

The "5 attempts" counter was stored in the session. With `SESSION_DRIVER=cookie`, that means it lived in a cookie the client controls. An attacker who knows the password could get around it three ways:
1. Post `/login` again, which reset the counter to 5.
2. Replay an older session cookie that still showed 5 attempts.
3. Send verify requests in parallel; each one read the counter before any wrote it back.

There was no limit per user or per IP, and no lockout. With the ±1 time-step window, 3 codes are valid at any moment, so on average about 333k guesses find one.

**Fix:**
- New columns `two_factor.failed_attempts` and `two_factor.locked_until`.
- Failures are counted with one atomic `UPDATE … RETURNING`.
- After 5 failures the account locks for 15 minutes. Each further failure doubles the lock, up to 24 hours.
- The counter resets only after a successful second factor; signing in with the password again does not reset it.
- `@adonisjs/limiter` throttles `POST /login` by IP and email, and `POST /verify-2fa` by IP and pending user.

### H2. TOTP code can be replayed
`two_factor_service.ts` (verifyCode)

Nothing recorded which time step had last been accepted. A captured code worked again for about 90 seconds, including from several sessions at once.

**Fix:**
- `verifyCode` now returns the time step that matched.
- A new column `two_factor.last_used_step` records the last accepted step.
- A code is accepted only through an atomic update guarded by `last_used_step < step`.

## Medium

### M1. Backup code can be used twice by parallel requests
The controller checked the code, filtered the array in memory, then saved the row. Two parallel requests with the same code could both sign in.

**Fix:** the code is removed in one update: `UPDATE … SET backup_codes_hashed = array_remove(…) WHERE … AND hash = ANY(…)`. Sign-in goes ahead only if exactly one row changed.

### M2. Expired-password path skips 2FA
`session_controller.ts:21-34`

When the password was correct but expired, the user got a reset link before 2FA was checked. Someone with only the password could set a new password on a 2FA-protected account and lock the real owner out.

**Fix:** when 2FA is on, the challenge runs first. The reset link is issued only after it is passed.

### M3. No re-confirmation for sensitive 2FA actions
Generating new backup codes needed only a session cookie, so a stolen session could create backup codes that keep working. Turning 2FA on didn't ask for the password and didn't sign out other sessions.

**Fix:**
- Generating new codes now requires a current authenticator code.
- Turning 2FA on requires the current password, and afterwards signs out every other session.
- Turning 2FA off requires the password plus a second factor.

### M4. Pending 2FA state never expires
The pending state lasted as long as the session (2 hours).

**Fix:** the pending state now expires after 5 minutes. All `two_factor_*` session keys are cleared on every exit path.

## Low

- **L1. Secret and backup codes kept in browser history.** The TOTP secret and plaintext backup codes travelled as Inertia props, which are stored in browser history state. **Fix:** those responses now use `inertia.encryptHistory()`, and the follow-up redirect calls `clearHistory()`.
- **L2. Backup codes stop working if the secret can't be decrypted.** The secret was decrypted before the backup-code branch ran, so a decryption failure (for example after rotating `APP_KEY`) also blocked backup codes. **Fix:** the secret is decrypted only for TOTP checks. When rotating `APP_KEY`, keep the old key in `config/encryption.ts`.
- **L3. Backup-code checks are expensive.** Each wrong code costs up to 10 scrypt hashes. **Mitigation:** the H1 throttles and lockout.
- **L4. OIDC tokens don't show that 2FA happened.** `auth_time` was the time the code was redeemed, not when the user signed in, and there was no `amr` claim. **Fix:**
  - The sign-in time and methods are kept in the session and copied onto the authorization code.
  - The ID token now carries the real `auth_time` and an `amr` claim: `pwd`, plus `otp` after a TOTP or backup code (and `mfa` with either).
  - `amr` is listed in the discovery document.
- **L5. Gaps in audit events and email notices.** **Fix:**
  - New audit events: `auth.2fa_locked`, `auth.2fa_disabled` and `auth.2fa_reset`.
  - Backup-code sign-ins record how many codes remain.
  - Email notices are sent for enable, disable, regenerate, admin reset and lockout.
- **L6. No tests.** **Fix:** added `tests/unit/two_factor_service.spec.ts` and `tests/functional/two_factor.spec.ts`.

## Gaps filled

- **F1. Users can turn 2FA off.** `POST /setup-2fa/disable` requires the password plus a TOTP or backup code. It is blocked when the org requires 2FA.
- **F2. Admin reset.** `DELETE /directory/:id/two-factor`, gated by the new permission `users.mfa.reset`. That permission is superadmin-only by default, and only a superadmin can reset a superadmin. The reset also signs the person out everywhere.
- **F3. Org-wide "require 2FA" policy.** Stored as `password_policy.extra_rules.requireTwoFactor`. When it is on, the `require_two_factor` middleware sends anyone who hasn't enrolled to `/setup-2fa` before they can use the console or finish an OAuth sign-in.

## Already correct

- The secret is 160 bits from `randomBytes`, encrypted at rest with AES-256-GCM, and excluded from serialization (`serializeAs: null`).
- HOTP truncation follows RFC 4226, and codes are compared in constant time.
- Backup codes are unbiased (256 % 32 = 0), about 40 bits each, and hashed with scrypt.
- The session guard regenerates the session ID on sign-in, which blocks session fixation.
- On verify, the pending user is checked again for being banned or deleted.
- CSRF protection is on. Password reset does not sign the user in. `postLoginPath` only accepts `/oauth/authorize?` paths, so it can't be used as an open redirect.

## Operational notes

- Run the new migrations: `node ace migration:run --connection=postgres_direct`.
- `LIMITER_STORE=database` stores throttle counters in the `rate_limits` table.
