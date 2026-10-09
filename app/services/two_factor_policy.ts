import PasswordPolicy from '#models/password_policy'

/**
 * Org-wide "everyone must use two-factor" switch, kept in the password policy
 * row's `extra_rules` JSON so it needs no schema change.
 */
export async function twoFactorRequired(): Promise<boolean> {
  const policy = await PasswordPolicy.query().first()
  return policy?.extraRules?.requireTwoFactor === true
}
