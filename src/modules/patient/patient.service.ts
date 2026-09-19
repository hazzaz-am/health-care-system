import { ConflictError, NotFoundError } from '../../lib/errors.js'
import { InMemoryPatientRepository } from './patient.repo.js'
import type {
  CreatePatientData,
  Patient,
  PatientRepository,
  UpdatePatientData,
} from './patient.types.js'

export interface PatientListResult {
  items: Patient[]
  total: number
  limit: number
  offset: number
}

/**
 * Business logic for patients.
 *
 * Note what is absent: no `Request`, no `Response`, no `next`. Keeping Express
 * out of this layer is what lets it be unit-tested with a plain function call,
 * and it is the rule that keeps a codebase navigable as it grows.
 */
export class PatientService {
  readonly #repo: PatientRepository

  constructor(repo: PatientRepository = new InMemoryPatientRepository()) {
    this.#repo = repo
  }

  async list(params: { limit: number; offset: number }): Promise<PatientListResult> {
    const [items, total] = await Promise.all([this.#repo.findAll(params), this.#repo.count()])
    return { items, total, limit: params.limit, offset: params.offset }
  }

  async getById(id: string): Promise<Patient> {
    const patient = await this.#repo.findById(id)
    if (patient === null) throw new NotFoundError('Patient')
    return patient
  }

  async create(data: CreatePatientData): Promise<Patient> {
    const existing = await this.#repo.findByEmail(data.email)
    if (existing !== null) {
      throw new ConflictError('A patient with this email already exists')
    }
    return this.#repo.create(data)
  }

  async update(id: string, data: UpdatePatientData): Promise<Patient> {
    // Uniqueness must be re-checked on update, otherwise a rename onto an
    // existing address slips through.
    if (data.email !== undefined) {
      const existing = await this.#repo.findByEmail(data.email)
      if (existing !== null && existing.id !== id) {
        throw new ConflictError('A patient with this email already exists')
      }
    }

    const updated = await this.#repo.update(id, data)
    if (updated === null) throw new NotFoundError('Patient')
    return updated
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.#repo.delete(id)
    if (!deleted) throw new NotFoundError('Patient')
  }
}

/** Process-wide singleton. Swap the repository argument to move to Postgres. */
export const patientService = new PatientService()
