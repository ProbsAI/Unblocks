import { describe, it, expect } from 'vitest'
import {
  AppError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  PlanLimitError,
  RateLimitError,
  ConflictError,
} from './types'

describe('AppError', () => {
  it('sets code, message, and default statusCode 500', () => {
    const error = new AppError('SOMETHING_WRONG', 'Something went wrong')

    expect(error.code).toBe('SOMETHING_WRONG')
    expect(error.message).toBe('Something went wrong')
    expect(error.statusCode).toBe(500)
    expect(error.name).toBe('AppError')
    expect(error.details).toBeUndefined()
  })

  it('accepts a custom statusCode and details', () => {
    const details = { field: 'email' }
    const error = new AppError('CUSTOM', 'Custom error', 422, details)

    expect(error.statusCode).toBe(422)
    expect(error.details).toEqual({ field: 'email' })
  })

  it('is an instance of Error', () => {
    const error = new AppError('CODE', 'msg')

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(AppError)
  })
})

describe('AuthError', () => {
  it('sets statusCode to 401', () => {
    const error = new AuthError('INVALID_CREDENTIALS', 'Invalid credentials')

    expect(error.code).toBe('INVALID_CREDENTIALS')
    expect(error.message).toBe('Invalid credentials')
    expect(error.statusCode).toBe(401)
    expect(error.name).toBe('AuthError')
  })

  it('is an instance of AppError', () => {
    const error = new AuthError('TOKEN_EXPIRED', 'Token expired')

    expect(error).toBeInstanceOf(AppError)
    expect(error).toBeInstanceOf(Error)
  })

  it('includes details when provided', () => {
    const error = new AuthError('AUTH_FAIL', 'Failed', { provider: 'google' })

    expect(error.details).toEqual({ provider: 'google' })
  })
})

describe('ForbiddenError', () => {
  it('uses default message when none is provided', () => {
    const error = new ForbiddenError()

    expect(error.code).toBe('FORBIDDEN')
    expect(error.message).toBe('You do not have permission to perform this action')
    expect(error.statusCode).toBe(403)
    expect(error.name).toBe('ForbiddenError')
  })

  it('accepts a custom message', () => {
    const error = new ForbiddenError('Admin only')

    expect(error.message).toBe('Admin only')
    expect(error.statusCode).toBe(403)
  })

  it('is an instance of AppError', () => {
    expect(new ForbiddenError()).toBeInstanceOf(AppError)
  })
})

describe('NotFoundError', () => {
  it('uses default "Resource" when no resource name is provided', () => {
    const error = new NotFoundError()

    expect(error.code).toBe('NOT_FOUND')
    expect(error.message).toBe('Resource not found')
    expect(error.statusCode).toBe(404)
    expect(error.name).toBe('NotFoundError')
  })

  it('includes resource name in message', () => {
    const error = new NotFoundError('User')

    expect(error.message).toBe('User not found')
  })

  it('is an instance of AppError', () => {
    expect(new NotFoundError()).toBeInstanceOf(AppError)
  })
})

describe('ValidationError', () => {
  it('sets statusCode to 400', () => {
    const error = new ValidationError('Invalid input')

    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.message).toBe('Invalid input')
    expect(error.statusCode).toBe(400)
    expect(error.name).toBe('ValidationError')
  })

  it('includes details when provided', () => {
    const details = { field: 'email', reason: 'required' }
    const error = new ValidationError('Bad request', details)

    expect(error.details).toEqual({ field: 'email', reason: 'required' })
  })

  it('is an instance of AppError', () => {
    expect(new ValidationError('msg')).toBeInstanceOf(AppError)
  })
})

describe('PlanLimitError', () => {
  it('sets statusCode to 402 and includes limit details', () => {
    const error = new PlanLimitError('projects', 5, 5)

    expect(error.code).toBe('PLAN_LIMIT_EXCEEDED')
    expect(error.message).toBe('You have reached the maximum projects for your plan.')
    expect(error.statusCode).toBe(402)
    expect(error.name).toBe('PlanLimitError')
    expect(error.details).toEqual({ limitKey: 'projects', current: 5, limit: 5 })
  })

  it('is an instance of AppError', () => {
    expect(new PlanLimitError('seats', 10, 10)).toBeInstanceOf(AppError)
  })
})

describe('RateLimitError', () => {
  it('sets statusCode to 429 and includes retryAfter in details', () => {
    const error = new RateLimitError(60)

    expect(error.code).toBe('RATE_LIMIT_EXCEEDED')
    expect(error.message).toBe('Too many requests. Please try again later.')
    expect(error.statusCode).toBe(429)
    expect(error.name).toBe('RateLimitError')
    expect(error.details).toEqual({ retryAfter: 60 })
  })

  it('has undefined retryAfter when not provided', () => {
    const error = new RateLimitError()

    expect(error.details).toEqual({ retryAfter: undefined })
  })

  it('is an instance of AppError', () => {
    expect(new RateLimitError()).toBeInstanceOf(AppError)
  })
})

describe('ConflictError', () => {
  it('sets statusCode to 409', () => {
    const error = new ConflictError('Email already exists')

    expect(error.code).toBe('CONFLICT')
    expect(error.message).toBe('Email already exists')
    expect(error.statusCode).toBe(409)
    expect(error.name).toBe('ConflictError')
  })

  it('includes details when provided', () => {
    const error = new ConflictError('Duplicate', { field: 'email' })

    expect(error.details).toEqual({ field: 'email' })
  })

  it('is an instance of AppError', () => {
    expect(new ConflictError('msg')).toBeInstanceOf(AppError)
  })
})
