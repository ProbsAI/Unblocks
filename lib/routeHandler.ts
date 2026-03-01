import { isRedirectError } from 'next/dist/client/components/redirect'
import { isNotFoundError } from 'next/dist/client/components/not-found'
import { toErrorResponse } from '@unblocks/core/errors/handler'

type RouteHandler = (
  request: Request,
  context: { params: Promise<Record<string, string>> }
) => Promise<Response>

export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (request: Request, context: { params: Promise<Record<string, string>> }) => {
    try {
      return await handler(request, context)
    } catch (error) {
      // Re-throw Next.js control-flow exceptions (redirect, notFound)
      if (isRedirectError(error) || isNotFoundError(error)) {
        throw error
      }
      const { body, status } = toErrorResponse(error)
      return Response.json(body, { status })
    }
  }
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
