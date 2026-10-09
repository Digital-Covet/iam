import env from '#start/env'

const BUCKET_FALLBACK = 'avatars'

/**
 * Small helper for profile photos.
 * Sends files to Supabase Object Storage and saves only
 * the public link on `user.image`.
 */
export default class AvatarService {
  static isConfigured() {
    return Boolean(env.get('SUPABASE_URL') && env.get('SUPABASE_SECRET_KEY'))
  }

  static bucket() {
    return env.get('AVATAR_BUCKET') || BUCKET_FALLBACK
  }

  /**
   * Upload a photo buffer and return its public URL.
   * Throws a friendly error when storage is not configured.
   */
  static async upload(userId: string, buffer: Buffer, contentType: string, ext: string) {
    const baseUrl = env.get('SUPABASE_URL')
    const secretKey = env.get('SUPABASE_SECRET_KEY')
    if (!baseUrl || !secretKey) {
      throw new Error('Photo uploads are not set up yet. Add SUPABASE_URL and SUPABASE_SECRET_KEY.')
    }

    const bucket = AvatarService.bucket()
    const cleanExt = ext.replace(/^\./, '').toLowerCase() || 'jpg'
    const path = `${userId}/avatar-${Date.now()}.${cleanExt}`
    const url = `${baseUrl.replace(/\/$/, '')}/storage/v1/object/${bucket}/${path}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        // Secret keys (sb_secret_…) are not JWTs: send them in `apikey` only, never as a Bearer token.
        'apikey': secretKey,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body: new Uint8Array(buffer),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(
        `Photo upload failed (${response.status}). Make sure the “${bucket}” bucket exists and is public. ${detail}`.trim()
      )
    }

    return {
      path,
      url: `${baseUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${path}`,
    }
  }

  /**
   * Delete a previously uploaded photo by its object key. Best effort: a
   * failure leaves an orphan file but must never block the profile save.
   */
  static async remove(path: string | null) {
    const baseUrl = env.get('SUPABASE_URL')
    const secretKey = env.get('SUPABASE_SECRET_KEY')
    if (!path || !baseUrl || !secretKey) return

    await fetch(`${baseUrl.replace(/\/$/, '')}/storage/v1/object/${AvatarService.bucket()}/${path}`, {
      method: 'DELETE',
      headers: { apikey: secretKey },
    }).catch(() => {})
  }
}
