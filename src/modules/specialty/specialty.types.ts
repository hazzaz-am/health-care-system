import type { Prisma, Specialty as SpecialtyModel } from '../../generated/prisma/client.js'

export type Specialty = Omit<SpecialtyModel, 'isDeleted' | 'deletedAt'>

export type CreateSpecialtyData = Pick<
  Prisma.SpecialtyUncheckedCreateInput,
  'title' | 'description' | 'icon'
>

export type UpdateSpecialtyData = Partial<CreateSpecialtyData>

export interface ListSpecialtiesParams {
  limit: number
  offset: number
}

/**
 * The port. Hand-written on purpose: this is the app's vocabulary for
 * persistence, not a mirror of Prisma's API. It exposes seven methods instead
 * of the ~25 the Prisma delegate offers, and every implementation is
 * compiler-checked against it.
 */
export interface SpecialtyRepository {
  findAll(params: ListSpecialtiesParams): Promise<Specialty[]>
  count(): Promise<number>
  findById(id: string): Promise<Specialty | null>
  findByTitle(title: string): Promise<Specialty | null>
  create(data: CreateSpecialtyData): Promise<Specialty>
  update(id: string, data: UpdateSpecialtyData): Promise<Specialty | null>
  softDelete(id: string): Promise<boolean>
}
