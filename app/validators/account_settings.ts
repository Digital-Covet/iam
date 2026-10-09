import vine from '@vinejs/vine'

/**
 * Account settings — self-service only, all roles.
 * Avatar file itself is read via `request.file('avatar')`,
 * not through Vine (Adonis file uploads live outside the body).
 */
export const profileValidator = vine.create({
  name: vine.string().trim().minLength(2).maxLength(100).nullable().optional(),
})

export const passwordValidator = vine.create({
  currentPassword: vine.string().minLength(1).maxLength(128),
  newPassword: vine.string().minLength(8).maxLength(72),
  newPasswordConfirmation: vine.string().sameAs('newPassword'),
})

export const revokeAppValidator = vine.create({
  enabled: vine.boolean(),
})
