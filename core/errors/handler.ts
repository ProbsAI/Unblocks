import { AppError } from './types'

export interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

export function toErrorResponse(error: unknown): {
  body: ErrorResponse
  status: number
} {
  if (error instanceof AppError) {
    return {
      body: {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      status: error.statusCode,
    }
  }

  // Unknown errors — don't leak internals
  console.error('Unhandled error:', error)
  return {
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
    status: 500,
  }
}
