import { Router } from 'express'
import type { Request, Response } from 'express'
import { specialtyRouter } from '../modules/specialty/specialty.routes.js'

export const apiRouter: Router = Router()

/** Version probe: lets a client confirm which API contract it is talking to. */
apiRouter.get('/', (_req: Request, res: Response) => {
  res.json({ version: 'v1', name: 'health-care-system' })
})

// apiRouter.use('/patients', patientRouter)
apiRouter.use('/specialties', specialtyRouter)
