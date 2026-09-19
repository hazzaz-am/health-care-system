import { pino } from 'pino'
import { env, isDevelopment } from './env.js'

/**
 * Application logger.
 *
 * Development: human-readable output via pino-pretty.
 * Production: newline-delimited JSON, one object per line, for log shippers.
 *
 * `redact` is intentionally conservative and important here: request bodies in
 * a health-care system routinely carry PHI, so anything that might be logged by
 * pino-http is stripped before it reaches a sink.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'health-care-system' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'req.body.password',
      'req.body.ssn',
      'req.body.dateOfBirth',
    ],
    censor: '[REDACTED]',
  },
  ...(isDevelopment
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname,service',
          },
        },
      }
    : {}),
})

export type Logger = typeof logger
