import { ConflictError, NotFoundError } from '../../lib/errors.js'
import { SpecialtyPrismaRepository } from './specialty.repo.js'
import type {
  CreateSpecialtyData,
  ListSpecialtiesParams,
  Specialty,
  SpecialtyRepository,
  UpdateSpecialtyData,
} from './specialty.types.js'

export interface SpecialtyListResult {
  items: Specialty[]
  total: number
  limit: number
  offset: number
}

const DUPLICATE_TITLE = 'A specialty with this title already exists'

/**
 * Business logic for specialties.
 *
 * Note what is absent: no `Request`, no `Response`, no `next`, and no Prisma.
 * The class depends on the `SpecialtyRepository` port, so it can be unit-tested
 * by passing a fake — no database required.
 */
export class SpecialtyService {
  readonly #repo: SpecialtyRepository

  constructor(repo: SpecialtyRepository = new SpecialtyPrismaRepository()) {
    this.#repo = repo
  }

  async list(params: ListSpecialtiesParams): Promise<SpecialtyListResult> {
    const [items, total] = await Promise.all([this.#repo.findAll(params), this.#repo.count()])
    return { items, total, limit: params.limit, offset: params.offset }
  }

  async getById(id: string): Promise<Specialty> {
    const specialty = await this.#repo.findById(id)
    if (specialty === null) throw new NotFoundError('Specialty')
    return specialty
  }

  async create(data: CreateSpecialtyData): Promise<Specialty> {
    const existing = await this.#repo.findByTitle(data.title)
    if (existing !== null) throw new ConflictError(DUPLICATE_TITLE)
    return this.#repo.create(data)
  }

  async update(id: string, data: UpdateSpecialtyData): Promise<Specialty> {
    // Uniqueness must be re-checked on update, otherwise a rename onto an
    // existing title slips through.
    if (data.title !== undefined) {
      const existing = await this.#repo.findByTitle(data.title)
      if (existing !== null && existing.id !== id) throw new ConflictError(DUPLICATE_TITLE)
    }

    const updated = await this.#repo.update(id, data)
    if (updated === null) throw new NotFoundError('Specialty')
    return updated
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.#repo.softDelete(id)
    if (!deleted) throw new NotFoundError('Specialty')
  }
}

/** Process-wide singleton. Swap the repository argument to change datastore. */
export const specialtyService = new SpecialtyService()
