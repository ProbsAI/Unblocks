import { describe, it, expect } from 'vitest'
import {
  assertSuccessResponse,
  assertErrorResponse,
  assertHasFields,
  assertRecentDate,
  assertUUID,
  assertSortedBy,
} from './assertions'

describe('assertSuccessResponse', () => {
  it('passes for a valid success response with default status 200', async () => {
    const response = Response.json({ data: { id: 1, name: 'test' } }, { status: 200 })

    const data = await assertSuccessResponse(response)
    expect(data).toEqual({ id: 1, name: 'test' })
  })

  it('passes for a 201 created response', async () => {
    const response = Response.json({ data: { id: 'new-item' } }, { status: 201 })

    const data = await assertSuccessResponse(response, 201)
    expect(data).toEqual({ id: 'new-item' })
  })

  it('returns the data from the response', async () => {
    const response = Response.json({ data: [1, 2, 3] }, { status: 200 })

    const data = await assertSuccessResponse<number[]>(response)
    expect(data).toEqual([1, 2, 3])
  })

  it('fails if status does not match', async () => {
    const response = Response.json({ data: {} }, { status: 201 })

    await expect(assertSuccessResponse(response, 200)).rejects.toThrow()
  })

  it('fails if data property is missing', async () => {
    const response = Response.json({ result: 'oops' }, { status: 200 })

    await expect(assertSuccessResponse(response)).rejects.toThrow()
  })
})

describe('assertErrorResponse', () => {
  it('passes for a valid error response', async () => {
    const response = Response.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } },
      { status: 400 }
    )

    const error = await assertErrorResponse(response, 400)
    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.message).toBe('Invalid input')
  })

  it('validates specific error code when provided', async () => {
    const response = Response.json(
      { error: { code: 'NOT_FOUND', message: 'Resource not found' } },
      { status: 404 }
    )

    const error = await assertErrorResponse(response, 404, 'NOT_FOUND')
    expect(error.code).toBe('NOT_FOUND')
  })

  it('fails if error code does not match expected code', async () => {
    const response = Response.json(
      { error: { code: 'WRONG_CODE', message: 'Something' } },
      { status: 400 }
    )

    await expect(assertErrorResponse(response, 400, 'EXPECTED_CODE')).rejects.toThrow()
  })

  it('fails if status does not match', async () => {
    const response = Response.json(
      { error: { code: 'ERROR', message: 'Oops' } },
      { status: 500 }
    )

    await expect(assertErrorResponse(response, 400)).rejects.toThrow()
  })

  it('fails if error property is missing', async () => {
    const response = Response.json({ data: 'not an error' }, { status: 400 })

    await expect(assertErrorResponse(response, 400)).rejects.toThrow()
  })
})

describe('assertUUID', () => {
  it('passes for a valid UUID v4', () => {
    // This should not throw
    assertUUID('550e8400-e29b-41d4-a716-446655440000')
  })

  it('passes for lowercase UUID', () => {
    assertUUID('6ba7b810-9dad-41d8-80b4-00c04fd430c8')
  })

  it('fails for an invalid UUID', () => {
    expect(() => assertUUID('not-a-uuid')).toThrow()
  })

  it('fails for a UUID with wrong version', () => {
    // Version 1 UUID (third group starts with 1, not 4)
    expect(() => assertUUID('550e8400-e29b-11d4-a716-446655440000')).toThrow()
  })

  it('fails for an empty string', () => {
    expect(() => assertUUID('')).toThrow()
  })

  it('fails for a UUID missing dashes', () => {
    expect(() => assertUUID('550e8400e29b41d4a716446655440000')).toThrow()
  })
})

describe('assertHasFields', () => {
  it('passes when object has all expected fields', () => {
    const obj = { id: '123', email: 'test@test.com', name: 'Test' }
    // Should not throw
    assertHasFields(obj, ['id', 'email', 'name'])
  })

  it('fails when a field is missing', () => {
    const obj = { id: '123', email: 'test@test.com' }
    expect(() => assertHasFields(obj, ['id', 'email', 'name'])).toThrow()
  })

  it('fails when a field is undefined', () => {
    const obj = { id: '123', email: undefined } as unknown as Record<string, unknown>
    expect(() => assertHasFields(obj, ['id', 'email'])).toThrow()
  })
})

describe('assertRecentDate', () => {
  it('passes for a date that was just created', () => {
    // Should not throw
    assertRecentDate(new Date())
  })

  it('passes for a recent ISO date string', () => {
    assertRecentDate(new Date().toISOString())
  })

  it('fails for a date far in the past', () => {
    expect(() => assertRecentDate(new Date('2020-01-01'), 5)).toThrow()
  })
})

describe('assertSortedBy', () => {
  it('passes for ascending sorted array', () => {
    const items = [{ val: 1 }, { val: 2 }, { val: 3 }]
    // Should not throw
    assertSortedBy(items, 'val', 'asc')
  })

  it('passes for descending sorted array', () => {
    const items = [{ val: 3 }, { val: 2 }, { val: 1 }]
    assertSortedBy(items, 'val', 'desc')
  })

  it('fails for unsorted array in ascending mode', () => {
    const items = [{ val: 3 }, { val: 1 }, { val: 2 }]
    expect(() => assertSortedBy(items, 'val', 'asc')).toThrow()
  })

  it('passes for empty array', () => {
    assertSortedBy([], 'val', 'asc')
  })

  it('passes for single item array', () => {
    assertSortedBy([{ val: 1 }], 'val', 'asc')
  })
})
