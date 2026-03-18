import { toErrorResponse } from '@unblocks/core/errors/handler'

type RouteHandler = (request: Request, context?: unknown) => Promise<Response>

export function withErrorHandler(handler: RouteHandler): RouteHandler {
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
