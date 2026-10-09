import env from '#start/env'
import { defineConfig, stores } from '@adonisjs/limiter'

const limiterConfig = defineConfig({
  default: env.get('LIMITER_STORE'),
  stores: {
    /**
     * Counters live in Postgres so every app instance shares them.
     * Uses the session-mode pooler: rate-limiter-flexible sends named
     * prepared statements (rate_limits:rlflx-*) which PgBouncer in
     * transaction mode (6543) rejects with 42P05 "already exists".
     */
    database: stores.database({
      tableName: 'rate_limits',
      connectionName: 'postgres_direct',
    }),

    /**
     * Per-process store, used by the test suite.
     */
    memory: stores.memory({}),
  },
})

export default limiterConfig

declare module '@adonisjs/limiter/types' {
  export interface LimitersList extends InferLimiters<typeof limiterConfig> {}
}
