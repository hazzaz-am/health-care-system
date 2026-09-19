import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

/**
 * Prisma 7 CLI configuration.
 *
 * In Prisma 7 the connection string moved OUT of the `datasource` block in
 * schema.prisma and into this file. The CLI reads `datasource.url` here for
 * `migrate` and `db` commands.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
})
