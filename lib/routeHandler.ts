import { toErrorResponse } from '@unblocks/core/errors/handler'

type NextRouteContext = { params: Promise<Record<string, string | string[]>> }

type RouteHandlerWithContext<C extends NextRouteContext> = (request: Request, context: C) => Promise<Response>
type RouteHandlerNoContext = (...args: [Request, ...unknown[]]) => Promise<Response>

export function withErrorHandler<C extends NextRouteContext>(handler: RouteHandlerWithContext<C>): (request: Request, context: C) => Promise<Response>
export function withErrorHandler(handler: RouteHandlerNoContext): (request: Request, context: NextRouteContext) => Promise<Response>
export function withErrorHandler(handler: (...args: unknown[]) => Promise<Response>): (request: Request, context: unknown) => Promise<Response> {
  return async (request, context) => {
    try {
      return await handler(request, context)
    } catch (error) {
      // Re-throw Next.js control-flow exceptions (redirect, notFound)
      if (isNextControlFlowError(error)) {
        throw error
      }
      const { body, status } = toErrorResponse(error)
      return Response.json(body, { status })
    }
  }
}

function isNextControlFlowError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const digest = (error as { digest?: string }).digest
  return typeof digest === 'string' && (
    digest.startsWith('NEXT_REDIRECT') || digest === 'NEXT_NOT_FOUND'
  )
}

export function getClientIp(request: Request): string | undefined {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    undefined
  )
}

export function getUserAgent(request: Request): string | undefined {
  return request.headers.get('user-agent') ?? undefined
}
