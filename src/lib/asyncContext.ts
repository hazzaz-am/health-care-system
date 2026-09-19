import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Request-scoped context. Lets code deep in the service/repository layer reach
 * the correlation id without threading it through every function signature.
 */
export interface RequestContext {
  requestId: string
}

export const requestContext = new AsyncLocalStorage<RequestContext>()

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId
}
