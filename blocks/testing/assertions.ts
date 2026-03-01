/**
 * Testing Block — Custom Assertions
 *
 * Domain-specific assertion helpers for Unblocks tests.
 * These make tests more readable and provide better error messages.
 *
 * Usage:
 *   assertSuccessResponse(response, 201)
 *   assertErrorResponse(response, 400, 'VALIDATION_ERROR')
 *   assertHasFields(user, ['id', 'email', 'name'])
 */
import { expect } from 'vitest'

/** Assert that a Response is a JSON success response with expected status */
export async function assertSuccessResponse<T = unknown>(
  response: Response,
  expectedStatus: number = 200
): Promise<T> {
  expect(response.status).toBe(expectedStatus)

  const json = await response.json()
  expect(json).toHaveProperty('data')
  return json.data as T
}

/** Assert that a Response is a JSON error response */
export async function assertErrorResponse(
  response: Response,
  expectedStatus: number,
  expectedCode?: string
): Promise<{ code: string; message: string; details?: Record<string, unknown> }> {
  expect(response.status).toBe(expectedStatus)

  const json = await response.json()
  expect(json).toHaveProperty('error')
  expect(json.error).toHaveProperty('code')
  expect(json.error).toHaveProperty('message')

  if (expectedCode) {
    expect(json.error.code).toBe(expectedCode)
  }

  return json.error
}

/** Assert that an object has all expected fields (non-undefined) */
export function assertHasFields(
  obj: Record<string, unknown>,
  fields: string[]
): void {
  for (const field of fields) {
    expect(obj).toHaveProperty(field)
    expect(obj[field]).not.toBeUndefined()
  }
}

/** Assert that a date string or Date is recent (within the last N seconds) */
export function assertRecentDate(
  date: string | Date,
  withinSeconds: number = 10
): void {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = Date.now()
  const diff = Math.abs(now - d.getTime())
  expect(diff).toBeLessThan(withinSeconds * 1000)
}

/** Assert that a string is a valid UUID v4 */
export function assertUUID(value: string): void {
  expect(value).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  )
}

/** Assert that an array is sorted by a key */
export function assertSortedBy<T>(
  items: T[],
  key: keyof T,
  direction: 'asc' | 'desc' = 'asc'
): void {
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1][key]
    const curr = items[i][key]
    if (direction === 'asc') {
      expect(prev <= curr).toBe(true)
    } else {
      expect(prev >= curr).toBe(true)
    }
  }
}

/** Assert that an email was sent to the expected address */
export function assertEmailSent(
  sentEmails: Array<{ to: string; subject: string }>,
  to: string,
  subjectContains?: string
): void {
  const match = sentEmails.find((e) => e.to === to)
  expect(match).toBeDefined()
  if (subjectContains && match) {
    expect(match.subject).toContain(subjectContains)
  }
}
