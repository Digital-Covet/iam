import vine from '@vinejs/vine'

export const verifyTotpValidator = vine.create({
  code: vine.string().regex(/^[0-9\s-]{6,12}$/),
})

export const verifyBackupCodeValidator = vine.create({
  backupCode: vine.string().minLength(4).maxLength(32),
})

export const setupConfirmValidator = vine.create({
  code: vine.string().regex(/^[0-9\s-]{6,12}$/),
  currentPassword: vine.string().minLength(1).maxLength(256),
})

export const regenerateValidator = vine.create({
  code: vine.string().regex(/^[0-9\s-]{6,12}$/),
})

export const disableValidator = vine.create({
  currentPassword: vine.string().minLength(1).maxLength(256),
  code: vine
    .string()
    .regex(/^[0-9\s-]{6,12}$/)
    .optional(),
  backupCode: vine.string().minLength(4).maxLength(32).optional(),
})
