import type { Request } from 'express'

declare global {
  namespace Express {
    interface Request {
      /** Authenticated principal, populated by the auth middleware. */
      user?: {
        id: string
        roles: string[]
      }
    }
  }
}

export type AuthenticatedRequest = Request & {
  user: NonNullable<Request['user']>
}
