import { Router } from 'express'
import type { Request, Response } from 'express'
import { env } from '../config/env.js'
import { checkReadiness } from '../modules/health/health.service.js'

export const healthRouter: Router = Router()

/**
 * Liveness: is the process up and able to serve?
 *
 * Deliberately does NOT touch the database. If it did, a transient database
 * blip would fail this probe and an orchestrator would restart every healthy
 * application container at once, turning a dependency outage into a total one.
 */
healthRouter.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  })
})

/**
 * Readiness: should this instance receive traffic?
 *
 * Runs a real database probe and reports 503 when it fails so a load balancer
 * can take the instance out of rotation without killing it.
 */
healthRouter.get('/readyz', async (_req: Request, res: Response) => {
  const result = await checkReadiness(env.DB_HEALTH_TIMEOUT_MS)
  res.status(result.status === 'ok' ? 200 : 503).json(result)
})
