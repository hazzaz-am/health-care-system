import { Router } from 'express'
import { validate } from '../../middleware/validate.js'
import {
  createSpecialty,
  deleteSpecialty,
  getSpecialtyById,
  listSpecialties,
  updateSpecialty,
} from './specialty.controller.js'
import {
  createSpecialtySchema,
  listSpecialtiesQuerySchema,
  specialtyIdParamSchema,
  updateSpecialtySchema,
} from './specialty.schema.js'

export const specialtyRouter: Router = Router()

/**
 * No `requireAuth` here: specialties are public reference data (the contents of
 * a dropdown), not PHI. If they become admin-managed, add `requireAuth` +
 * a role check to the POST / PATCH / DELETE routes only.
 */
specialtyRouter.get('/', validate(listSpecialtiesQuerySchema, 'query'), listSpecialties)

specialtyRouter.get('/:id', validate(specialtyIdParamSchema, 'params'), getSpecialtyById)

specialtyRouter.post('/', validate(createSpecialtySchema, 'body'), createSpecialty)

specialtyRouter.patch(
  '/:id',
  validate(specialtyIdParamSchema, 'params'),
  validate(updateSpecialtySchema, 'body'),
  updateSpecialty,
)

specialtyRouter.delete('/:id', validate(specialtyIdParamSchema, 'params'), deleteSpecialty)
