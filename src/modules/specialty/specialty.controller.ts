import type { Request, Response } from 'express'
import { specialtyService } from './specialty.service.js'
import type {
  CreateSpecialtyInput,
  ListSpecialtiesQuery,
  UpdateSpecialtyInput,
} from './specialty.schema.js'

/**
 * Controllers translate HTTP into plain service calls and back.
 *
 * Declared as standalone functions rather than methods on an object literal, so
 * they can be passed straight to the router without an unbound-method hazard.
 *
 * Handlers are `async` with no try/catch and no `next(error)`: Express 5
 * forwards rejected promises to the error middleware automatically.
 */
export async function listSpecialties(req: Request, res: Response): Promise<void> {
  const { limit, offset } = req.query as unknown as ListSpecialtiesQuery
  res.json(await specialtyService.list({ limit, offset }))
}

export async function getSpecialtyById(req: Request, res: Response): Promise<void> {
  const specialty = await specialtyService.getById(req.params.id as string)
  res.json({ data: specialty })
}

export async function createSpecialty(req: Request, res: Response): Promise<void> {
  const specialty = await specialtyService.create(req.body as CreateSpecialtyInput)
  res.status(201).location(`/api/v1/specialties/${specialty.id}`).json({ data: specialty })
}

export async function updateSpecialty(req: Request, res: Response): Promise<void> {
  const specialty = await specialtyService.update(
    req.params.id as string,
    req.body as UpdateSpecialtyInput,
  )
  res.json({ data: specialty })
}

export async function deleteSpecialty(req: Request, res: Response): Promise<void> {
  await specialtyService.remove(req.params.id as string)
  res.status(204).send()
}
