import db from '@adonisjs/lucid/services/db'
import Role from '#models/role'
import User from '#models/user'
import CredentialService from '#services/credential_service'
import SessionTracker from '#services/session_tracker'
import { PASSWORD_ONLY, rememberSignIn } from '#services/sign_in_context'
import { signupValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class NewAccountController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/signup', {})
  }

  async store(ctx: HttpContext) {
    const { request, response, auth } = ctx
    const { fullName, email, password } = await request.validateUsing(signupValidator)
    const defaultRole = await Role.findByOrFail('name', 'employee')

    const user = await db.transaction(async (trx) => {
      const created = await User.create(
        {
          email,
          name: fullName,
          roleId: defaultRole.id,
          emailVerified: false,
        },
        { client: trx }
      )

      await CredentialService.createAccount(created, password, trx)
      return created
    })

    await auth.use('web').login(user)
    await SessionTracker.recordLogin(ctx, user, 'signup')
    rememberSignIn(ctx.session, PASSWORD_ONLY)
    response.redirect().toRoute('dashboard')
  }
}
