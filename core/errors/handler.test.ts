import { describe, it, expect, vi } from 'vitest'
import { toErrorResponse } from './handler'
import { AppError, AuthError, ValidationError, NotFoundError } from './types'

describe('toErrorResponse', () => {
  it('maps AppError to correct response body and status', () => {
    const error = new AppError('CUSTOM', 'Custom error', 500, { extra: true })
    const result = toErrorResponse(error)

    expect(result.status).toBe(500)
    expect(result.body).toEqual({
      error: {
        code: 'CUSTOM',
        message: 'Custom error',
        details: { extra: true },
      },
    })
  })

  it('maps AuthError to 401', () => {
    const error = new AuthError('INVALID_TOKEN', 'Token is invalid')
    const result = toErrorResponse(error)

    expect(result.status).toBe(401)
    expect(result.body.error.code).toBe('INVALID_TOKEN')
    expect(result.body.error.message).toBe('Token is invalid')
  })

  it('maps ValidationError to 400', () => {
    const error = new ValidationError('Bad input', { field: 'name' })
    const result = toErrorResponse(error)

    expect(result.status).toBe(400)
    expect(result.body.error.code).toBe('VALIDATION_ERROR')
    expect(result.body.error.details).toEqual({ field: 'name' })
  })

  it('maps NotFoundError to 404', () => {
    const error = new NotFoundError('User')
    const result = toErrorResponse(error)

    expect(result.status).toBe(404)
    expect(result.body.error.code).toBe('NOT_FOUND')
    expect(result.body.error.message).toBe('User not found')
  })

  it('maps unknown errors to 500 INTERNAL_ERROR', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = toErrorResponse(new Error('something broke'))

    expect(result.status).toBe(500)
    expect(result.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    })

    consoleSpy.mockRestore()
  })

  it('does not leak error details for unknown errors', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = toErrorResponse({ secret: 'password123' })

    expect(result.body.error).not.toHaveProperty('details')
    expect(result.body.error.message).toBe('An unexpected error occurred')
    expect(result.status).toBe(500)

    consoleSpy.mockRestore()
  })

  it('maps string errors to 500 INTERNAL_ERROR', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = toErrorResponse('unexpected string error')

    expect(result.status).toBe(500)
    expect(result.body.error.code).toBe('INTERNAL_ERROR')

    consoleSpy.mockRestore()
  })
})
