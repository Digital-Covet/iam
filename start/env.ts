/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // App
  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),

  // Session
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory', 'database'] as const),

  // Database — Supabase poolers
  // DATABASE_URL: transaction-mode pooler (6543, pgbouncer=true) for runtime
  // DIRECT_URL: session-mode pooler (5432) for migrations/DDL
  DATABASE_URL: Env.schema.string(),
  DIRECT_URL: Env.schema.string(),

  // Supabase Object Storage — avatar uploads (optional until configured)
  SUPABASE_URL: Env.schema.string.optional(),
  SUPABASE_SECRET_KEY: Env.schema.string.optional(),
  AVATAR_BUCKET: Env.schema.string.optional(),

  // OAuth/OIDC provider — RS256 private key (PEM, base64-encoded onto one line)
  OAUTH_PRIVATE_KEY_B64: Env.schema.string.optional(),

  // ZeptoMail — invite / reset emails. Without a token, emails are logged instead.
  ZEPTOMAIL_URL: Env.schema.string.optional(),
  ZEPTOMAIL_TOKEN: Env.schema.string.optional(),
  ZEPTOMAIL_SENDER_ADDRESS: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring the limiter package
  |----------------------------------------------------------
  */
  LIMITER_STORE: Env.schema.enum(['database', 'memory'] as const)
})
