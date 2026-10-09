import PasswordPolicy from '#models/password_policy'

/** Simple-language password rule check against the policy row. */
export function policyError(password: string, policy: PasswordPolicy | null): string | null {
  const min = policy?.minLength ?? 8
  if (password.length < min) return `Use at least ${min} characters.`
  if (policy?.requireUppercase && !/[A-Z]/.test(password)) return 'Add one capital letter (A–Z).'
  if (policy?.requireLowercase && !/[a-z]/.test(password)) return 'Add one small letter (a–z).'
  if (policy?.requireNumber && !/[0-9]/.test(password)) return 'Add one number (0–9).'
  if (policy?.requireSpecial && !/[^A-Za-z0-9]/.test(password))
    return 'Add one symbol (for example ! or #).'
  return null
}

export async function checkPasswordPolicy(password: string): Promise<string | null> {
  return policyError(password, await PasswordPolicy.query().first())
}
