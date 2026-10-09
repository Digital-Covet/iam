import { test } from '@japa/runner'
import OAuthService from '#services/oauth_service'

const user = {
  id: 'u1',
  name: 'Ada',
  email: 'ada@example.com',
  emailVerified: true,
  image: null,
  role: { name: 'admin' },
} as any

test.group('OAuthService | userClaims roles', () => {
  test('roles scope adds the role claim', async ({ assert }) => {
    const claims = await OAuthService.userClaims(user, ['openid', 'roles'])
    assert.equal(claims.role, 'admin')
  })

  test('role is omitted without the roles scope', async ({ assert }) => {
    const claims = await OAuthService.userClaims(user, ['openid', 'profile'])
    assert.notProperty(claims, 'role')
    assert.equal(claims.email, 'ada@example.com')
  })
})
