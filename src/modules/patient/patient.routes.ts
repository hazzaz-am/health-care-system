import { Router } from 'express'
import { validate } from '../../middleware/validate.js'
import { requireAuth } from '../../middleware/requireAuth.js'
import {
  createPatient,
  deletePatient,
  getPatientById,
  listPatients,
  updatePatient,
} from './patient.controller.js'
import {
  createPatientSchema,
  listPatientsQuerySchema,
  patientIdParamSchema,
  updatePatientSchema,
} from './patient.schema.js'

export const patientRouter: Router = Router()

// Every patient route requires an authenticated principal: this is PHI.
patientRouter.use(requireAuth)

patientRouter.get('/', validate(listPatientsQuerySchema, 'query'), listPatients)

patientRouter.get('/:id', validate(patientIdParamSchema, 'params'), getPatientById)

patientRouter.post('/', validate(createPatientSchema, 'body'), createPatient)

patientRouter.patch(
  '/:id',
  validate(patientIdParamSchema, 'params'),
  validate(updatePatientSchema, 'body'),
  updatePatient,
)

patientRouter.delete('/:id', validate(patientIdParamSchema, 'params'), deletePatient)
