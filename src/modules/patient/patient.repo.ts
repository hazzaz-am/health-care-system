import { randomUUID } from 'node:crypto'
import type {
  CreatePatientData,
  Patient,
  PatientRepository,
  UpdatePatientData,
} from './patient.types.js'

/**
 * In-memory repository.
 *
 * This exists so the API is runnable and testable before a database is wired
 * up. It implements the same `PatientRepository` port as the Prisma-backed
 * version, so swapping it is a one-line change in `patient.service.ts` and no
 * other file is touched.
 *
 * Replace with `PatientPrismaRepository` (see README) before production: state
 * here is per-process and lost on restart.
 */
export class InMemoryPatientRepository implements PatientRepository {
  readonly #patients = new Map<string, Patient>()
  #sequence = 0

  constructor(seed: boolean = true) {
    if (seed) {
      this.#seed()
    }
  }

  findAll({ limit, offset }: { limit: number; offset: number }): Promise<Patient[]> {
    return Promise.resolve(
      [...this.#patients.values()]
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(offset, offset + limit),
    )
  }

  count(): Promise<number> {
    return Promise.resolve(this.#patients.size)
  }

  findById(id: string): Promise<Patient | null> {
    return Promise.resolve(this.#patients.get(id) ?? null)
  }

  findByEmail(email: string): Promise<Patient | null> {
    const normalized = email.toLowerCase()
    for (const patient of this.#patients.values()) {
      if (patient.email.toLowerCase() === normalized) return Promise.resolve(patient)
    }
    return Promise.resolve(null)
  }

  create(data: CreatePatientData): Promise<Patient> {
    const now = new Date()
    const patient: Patient = {
      id: randomUUID(),
      ...data,
      createdAt: now,
      updatedAt: now,
    }
    this.#patients.set(patient.id, patient)
    return Promise.resolve(patient)
  }

  update(id: string, data: UpdatePatientData): Promise<Patient | null> {
    const existing = this.#patients.get(id)
    if (existing === undefined) return Promise.resolve(null)

    const updated: Patient = { ...existing, ...data, updatedAt: new Date() }
    this.#patients.set(id, updated)
    return Promise.resolve(updated)
  }

  delete(id: string): Promise<boolean> {
    return Promise.resolve(this.#patients.delete(id))
  }

  #seed(): void {
    const sample: Array<Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>> = [
      {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada.lovelace@example.com',
        dateOfBirth: '1985-12-10',
        phone: '+15550100',
      },
    ]

    for (const entry of sample) {
      this.#sequence += 1
      const now = new Date()
      const id = `00000000-0000-4000-8000-${String(this.#sequence).padStart(12, '0')}`
      this.#patients.set(id, { id, ...entry, createdAt: now, updatedAt: now })
    }
  }
}
