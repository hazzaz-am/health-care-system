import { z } from 'zod'

export const createPatientSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  email: z.email('A valid email address is required'),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD')
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Date of birth is not a real date'),
  phone: z.string().trim().min(7).max(20).optional(),
})

export const updatePatientSchema = createPatientSchema.partial()

export const listPatientsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export const patientIdParamSchema = z.object({
  id: z.uuid('Patient id must be a UUID'),
})

export type CreatePatientInput = z.infer<typeof createPatientSchema>
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>
export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>
