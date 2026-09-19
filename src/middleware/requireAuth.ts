import type { RequestHandler } from 'express'
import { UnauthorizedError } from '../lib/errors.js'

/**
 * Placeholder authentication gate.
 *
 * This is deliberately a stub: it demonstrates where authentication belongs in
 * the middleware chain and gives protected routes a real 401 path to test.
 * Replace the body with JWT verification / session lookup before shipping.
 */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization

  if (!header?.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing or malformed Authorization header'))
    return
  }

  const token = header.slice('Bearer '.length).trim()
  if (token.length === 0) {
    next(new UnauthorizedError('Empty bearer token'))
    return
  }

  // TODO: verify the token and attach the principal.
  req.user = { id: 'stub-user', roles: ['clinician'] }
  next()
}
