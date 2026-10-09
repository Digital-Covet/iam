import vine from '@vinejs/vine'

/**
 * OAuth consent decision — the client only ever sends the server-issued
 * requestId. Authorization params (client, redirect URI, scopes, PKCE,
 * state) are re-read from the server-side pending store, never trusted
 * from the request body.
 */
export const consentDecisionValidator = vine.create({
  requestId: vine.string().uuid(),
})
