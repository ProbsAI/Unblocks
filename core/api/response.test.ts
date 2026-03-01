import { describe, it, expect } from 'vitest'
import { successResponse, errorResponse } from './response'

describe('successResponse', () => {
  it('returns JSON with { data } and status 200 by default', async () => {
    const response = successResponse({ id: 1, name: 'test' })

    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json).toEqual({ data: { id: 1, name: 'test' } })
  })

  it('includes meta when provided', async () => {
    const meta = { page: 1, pageSize: 10, total: 50, hasMore: true }
    const response = successResponse([1, 2, 3], meta)

    const json = await response.json()
    expect(json).toEqual({
      data: [1, 2, 3],
      meta: { page: 1, pageSize: 10, total: 50, hasMore: true },
    })
  })

  it('does not include meta when not provided', async () => {
    const response = successResponse('hello')

    const json = await response.json()
    expect(json).toEqual({ data: 'hello' })
    expect(json).not.toHaveProperty('meta')
  })

  it('uses custom status code when provided', async () => {
    const response = successResponse({ created: true }, undefined, 201)

    expect(response.status).toBe(201)

    const json = await response.json()
    expect(json).toEqual({ data: { created: true } })
  })

  it('handles null data', async () => {
    const response = successResponse(null)

    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json).toEqual({ data: null })
  })
})

describe('errorResponse', () => {
  it('returns JSON with { error: { code, message } } and default 400 status', async () => {
    const response = errorResponse('VALIDATION_ERROR', 'Invalid input')

    expect(response.status).toBe(400)

    const json = await response.json()
    expect(json).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: undefined,
      },
    })
  })

  it('uses custom status code', async () => {
    const response = errorResponse('NOT_FOUND', 'Resource not found', 404)

    expect(response.status).toBe(404)

    const json = await response.json()
    expect(json.error.code).toBe('NOT_FOUND')
    expect(json.error.message).toBe('Resource not found')
  })

  it('includes details when provided', async () => {
    const details = { field: 'email', reason: 'already exists' }
    const response = errorResponse('CONFLICT', 'Duplicate entry', 409, details)

    expect(response.status).toBe(409)

    const json = await response.json()
    expect(json.error.details).toEqual({
      field: 'email',
      reason: 'already exists',
    })
  })

  it('returns proper error structure for 500 errors', async () => {
    const response = errorResponse('INTERNAL_ERROR', 'Something went wrong', 500)

    expect(response.status).toBe(500)

    const json = await response.json()
    expect(json.error).toHaveProperty('code', 'INTERNAL_ERROR')
    expect(json.error).toHaveProperty('message', 'Something went wrong')
  })
})
