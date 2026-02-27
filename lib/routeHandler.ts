import { toErrorResponse } from '@unblocks/core/errors/handler'
import { AppError } from '@unblocks/core/errors/types'

type RouteHandler = (
  request: Request,
  context?: { params: Promise<Record<string, string>> }
) => Promise<Response>

export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (request, context) => {
    try {
      return await handler(request, context)
    } catch (error) {
      const { body, status } = toErrorResponse(error)
      return Response.json(body, { status })
    }
  }
}

export function getClientIp(request: Request): string | null {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null
  )
}

export function getUserAgent(request: Request): string | null {
  return request.headers.get('user-agent')
}
