import { args, BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Role from '#models/role'
import User from '#models/user'
import CredentialService from '#services/credential_service'

/**
 * Bootstraps the first superadmin on an empty database.
 *
 *   node ace create:superadmin admin@example.com --name="Admin"
 *
 * The password is prompted for (hidden) unless passed with --password.
 */
export default class CreateSuperadmin extends BaseCommand {
  static commandName = 'create:superadmin'
  static description = 'Create a superadmin user with a credential (email + password) account'

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'Email address of the superadmin' })
  declare email: string

  @flags.string({ description: 'Display name', default: 'Super Admin' })
  declare name: string

  @flags.string({ description: 'Password (prompted for when omitted)' })
  declare password?: string

  async run() {
    const email = this.email.trim().toLowerCase()

    const role = await Role.findBy('name', 'superadmin')
    if (!role) {
      this.logger.error('The "superadmin" role does not exist. Run `node ace db:seed` first.')
      this.exitCode = 1
      return
    }

    if (await User.query().where('email', email).first()) {
      this.logger.error(`A user with the email ${email} already exists.`)
      this.exitCode = 1
      return
    }

    const password: string =
      this.password ??
      (await this.prompt.secure('Password', {
        validate: (value) => (value.length >= 8 ? true : 'Use at least 8 characters'),
      }))!

    await db.transaction(async (trx) => {
      const user = await User.create(
        {
          email,
          name: this.name,
          roleId: role.id,
          emailVerified: true,
          emailVerifiedAt: DateTime.now(),
        },
        { client: trx }
      )
      await CredentialService.createAccount(user, password, trx)
    })

    this.logger.success(`Superadmin ${email} created.`)
  }
}
