import type { Request, Response } from 'express'
import { patientService } from './patient.service.js'
import type { CreatePatientInput, ListPatientsQuery, UpdatePatientInput } from './patient.schema.js'

/**
 * Controllers translate HTTP into plain service calls and back.
 *
 * Declared as standalone functions rather than methods on an object literal, so
 * they can be passed straight to the router without an unbound-method hazard.
 *
 * Handlers are `async` with no try/catch and no `next(error)`: Express 5
 * forwards rejected promises to the error middleware automatically. The
 * `asyncHandler` wrapper that Express 4 required is obsolete.
 */
export async function listPatients(req: Request, res: Response): Promise<void> {
  const { limit, offset } = req.query as unknown as ListPatientsQuery
  const result = await patientService.list({ limit, offset })
  res.json(result)
}

export async function getPatientById(req: Request, res: Response): Promise<void> {
  const patient = await patientService.getById(req.params.id as string)
  res.json({ data: patient })
}

export async function createPatient(req: Request, res: Response): Promise<void> {
  const patient = await patientService.create(req.body as CreatePatientInput)
  res.status(201).location(`/api/v1/patients/${patient.id}`).json({ data: patient })
}

export async function updatePatient(req: Request, res: Response): Promise<void> {
  const patient = await patientService.update(
    req.params.id as string,
    req.body as UpdatePatientInput,
  )
  res.json({ data: patient })
}

export async function deletePatient(req: Request, res: Response): Promise<void> {
  await patientService.remove(req.params.id as string)
  res.status(204).send()
}
