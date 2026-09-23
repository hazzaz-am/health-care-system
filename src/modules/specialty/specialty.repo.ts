import { prisma } from '../../db/client.js'
import type { Prisma, Specialty as SpecialtyModel } from '../../generated/prisma/client.js'
import type {
  CreateSpecialtyData,
  ListSpecialtiesParams,
  Specialty,
  SpecialtyRepository,
  UpdateSpecialtyData,
} from './specialty.types.js'

/**
 * Every read and write is scoped to non-deleted rows. Typed as Prisma's own
 * `WhereInput`, so a column rename breaks the build instead of silently
 * returning everything.
 */
const NOT_DELETED: Prisma.SpecialtyWhereInput = { isDeleted: false }

/**
 * Row -> domain. Names only the fields being *withheld* rather than the fields
 * being kept, so a new column on the model flows through to the API without an
 * edit here. The only lossy step is the soft-delete bookkeeping.
 */
function toDomain(row: SpecialtyModel): Specialty {
  const { isDeleted: _isDeleted, deletedAt: _deletedAt, ...rest } = row
  return rest
}

/**
 * Postgres-backed implementation of the `SpecialtyRepository` port.
 *
 * This is the only file in the module that knows Prisma exists. Swapping the
 * datastore means rewriting this file and nothing else.
 */
export class SpecialtyPrismaRepository implements SpecialtyRepository {
  async findAll({ limit, offset }: ListSpecialtiesParams): Promise<Specialty[]> {
    const rows = await prisma.specialty.findMany({
      where: NOT_DELETED,
      orderBy: { title: 'asc' },
      skip: offset,
      take: limit,
    })

    return rows.map(toDomain)
  }

  count(): Promise<number> {
    return prisma.specialty.count({ where: NOT_DELETED })
  }

  async findById(id: string): Promise<Specialty | null> {
    const row = await prisma.specialty.findFirst({ where: { id, ...NOT_DELETED } })
    return row === null ? null : toDomain(row)
  }

  /**
   * `findFirst` rather than `findUnique`: the unique input cannot carry the
   * `isDeleted` filter, so a soft-deleted row would block re-creating its title
   * forever. Scoping the lookup to live rows makes the check match the unique
   * index the database actually enforces on live data.
   */
  async findByTitle(title: string): Promise<Specialty | null> {
    const row = await prisma.specialty.findFirst({ where: { title, ...NOT_DELETED } })
    return row === null ? null : toDomain(row)
  }

  async create(data: CreateSpecialtyData): Promise<Specialty> {
    const row = await prisma.specialty.create({ data })
    return toDomain(row)
  }

  /**
   * `updateMany` rather than `update`: `update` throws P2025 on a missing or
   * already-deleted row, which would surface as a generic error. `updateMany`
   * reports a count, so the service can raise its own NotFoundError.
   */
  async update(id: string, data: UpdateSpecialtyData): Promise<Specialty | null> {
    const { count } = await prisma.specialty.updateMany({
      where: { id, ...NOT_DELETED },
      data,
    })

    if (count === 0) return null
    return this.findById(id)
  }

  /** Soft delete: flips the flags so history and references survive. */
  async softDelete(id: string): Promise<boolean> {
    const { count } = await prisma.specialty.updateMany({
      where: { id, ...NOT_DELETED },
      data: { isDeleted: true, deletedAt: new Date() },
    })

    return count > 0
  }
}
