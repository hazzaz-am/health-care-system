import { z } from 'zod'

export const createSpecialtySchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100),
  description: z.string().trim().max(2000).nullish(),
  icon: z.string().trim().max(255).nullish(),
})

export const updateSpecialtySchema = createSpecialtySchema.partial()

export const listSpecialtiesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export const specialtyIdParamSchema = z.object({
  id: z.uuid('Specialty id must be a UUID'),
})

export type CreateSpecialtyInput = z.infer<typeof createSpecialtySchema>
export type UpdateSpecialtyInput = z.infer<typeof updateSpecialtySchema>
export type ListSpecialtiesQuery = z.infer<typeof listSpecialtiesQuerySchema>
