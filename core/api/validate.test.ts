import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { validateBody } from './validate'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeBadRequest(text: string): Request {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: text,
  })
}

const schema = z.object({
  name: z.string(),
  age: z.number().min(0),
})

describe('validateBody', () => {
  it('returns parsed data for valid input', async () => {
    const req = makeRequest({ name: 'Alice', age: 30 })
    const result = await validateBody(req, schema)
    expect(result).toEqual({ name: 'Alice', age: 30 })
  })

  it('throws ValidationError for invalid JSON', async () => {
    const req = makeBadRequest('not-json{')
    await expect(validateBody(req, schema)).rejects.toThrow('Invalid JSON')
  })

  it('throws ValidationError for schema mismatch', async () => {
    const req = makeRequest({ name: 123, age: -1 })
    await expect(validateBody(req, schema)).rejects.toThrow('Validation failed')
  })

  it('throws ValidationError with field details', async () => {
    const req = makeRequest({ name: 123 })
    try {
      await validateBody(req, schema)
      expect.fail('should have thrown')
    } catch (error: unknown) {
      const err = error as { details?: { fields?: Record<string, string[]> } }
      expect(err.details?.fields).toBeDefined()
    }
  })

  it('strips extra fields with strict schema', async () => {
    const strictSchema = z.object({ name: z.string() }).strict()
    const req = makeRequest({ name: 'Bob', extra: true })
    await expect(validateBody(req, strictSchema)).rejects.toThrow('Validation failed')
  })
})
