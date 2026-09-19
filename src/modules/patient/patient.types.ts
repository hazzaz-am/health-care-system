/**
 * Domain model.
 *
 * Declared by hand rather than inferred from the Zod schema so the domain shape
 * and the transport shape can diverge (e.g. `dateOfBirth` may map to a Date in
 * the database while the API still speaks ISO strings).
 */
export interface Patient {
  id: string
  firstName: string
  lastName: string
  email: string
  dateOfBirth: string
  phone?: string
  createdAt: Date
  updatedAt: Date
}

export interface CreatePatientData {
  firstName: string
  lastName: string
  email: string
  dateOfBirth: string
  phone?: string
}

export type UpdatePatientData = Partial<CreatePatientData>

export interface PatientRepository {
  findAll(params: { limit: number; offset: number }): Promise<Patient[]>
  count(): Promise<number>
  findById(id: string): Promise<Patient | null>
  findByEmail(email: string): Promise<Patient | null>
  create(data: CreatePatientData): Promise<Patient>
  update(id: string, data: UpdatePatientData): Promise<Patient | null>
  delete(id: string): Promise<boolean>
}
