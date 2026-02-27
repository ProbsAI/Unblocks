export interface SuccessResponse<T = unknown> {
  data: T
  meta?: {
    page?: number
    pageSize?: number
    total?: number
    hasMore?: boolean
  }
}

export interface ErrorResponseBody {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

export function successResponse<T>(
  data: T,
  meta?: SuccessResponse['meta'],
  status: number = 200
): Response {
  const body: SuccessResponse<T> = { data }
  if (meta) body.meta = meta

  return Response.json(body, { status })
}

export function errorResponse(
  code: string,
  message: string,
  status: number = 400,
  details?: Record<string, unknown>
): Response {
  const body: ErrorResponseBody = {
    error: { code, message, details },
  }

  return Response.json(body, { status })
}
