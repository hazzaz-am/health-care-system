import { z } from 'zod'

/**
 * Environment schema. Parsed once at boot so the process fails fast and loudly
 * on bad configuration instead of throwing on the first request.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine(
      (value) => value.startsWith('postgresql://') || value.startsWith('postgres://'),
      'DATABASE_URL must be a postgresql:// connection string',
    ),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // Comma-separated origins. Empty means "no cross-origin browser access".
  CORS_ORIGIN: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  // How long a single database connectivity probe may take, in milliseconds.
  DB_HEALTH_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
})

export type Env = z.infer<typeof envSchema>

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')
    // Cannot use the logger here: the logger depends on config.
    process.stderr.write(`Invalid environment configuration:\n${details}\n`)
    process.exit(1)
  }

  return parsed.data
}

export const env: Env = loadEnv()

export const isProduction = env.NODE_ENV === 'production'
export const isDevelopment = env.NODE_ENV === 'development'
export const isTest = env.NODE_ENV === 'test'
