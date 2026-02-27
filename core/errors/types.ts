export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class AuthError extends AppError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, 401, details)
    this.name = 'AuthError'
  }
}

export class ForbiddenError extends AppError {
  constructor(
    message: string = 'You do not have permission to perform this action',
    details?: Record<string, unknown>
  ) {
    super('FORBIDDEN', message, 403, details)
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends AppError {
  constructor(
    resource: string = 'Resource',
    details?: Record<string, unknown>
  ) {
    super('NOT_FOUND', `${resource} not found`, 404, details)
    this.name = 'NotFoundError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details)
    this.name = 'ValidationError'
  }
}

export class PlanLimitError extends AppError {
  constructor(
    limitKey: string,
    current: number,
    limit: number
  ) {
    super(
      'PLAN_LIMIT_EXCEEDED',
      `You have reached the maximum ${limitKey} for your plan.`,
      402,
      { limitKey, current, limit }
    )
    this.name = 'PlanLimitError'
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSeconds?: number) {
    super('RATE_LIMIT_EXCEEDED', 'Too many requests. Please try again later.', 429, {
      retryAfter: retryAfterSeconds,
    })
    this.name = 'RateLimitError'
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CONFLICT', message, 409, details)
    this.name = 'ConflictError'
  }
}
