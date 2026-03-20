import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { validateBody } from './validate'
import { ValidationError } from '../errors/types'

function makeRequest(body: unknown): Request {
  return new Request('http://test', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function makeRawRequest(text: string): Request {
  return new Request('http://test', {
    method: 'POST',
    body: text,
  })
}

const schema = z.object({
  name: z.string(),
  age: z.number().min(0),
})

describe('validateBody', () => {
  // 1. Valid JSON parsing and schema validation
  it('returns parsed data for valid input', async () => {
    const req = makeRequest({ name: 'Alice', age: 30 })
    const result = await validateBody(req, schema)
    expect(result).toEqual({ name: 'Alice', age: 30 })
  })

  it('strips unknown fields when schema does not use strict', async () => {
    const req = makeRequest({ name: 'Bob', age: 25, extra: true })
    const result = await validateBody(req, schema)
    expect(result).toEqual({ name: 'Bob', age: 25 })
  })

  it('works with different schema types', async () => {
    const arraySchema = z.array(z.string())
    const req = makeRequest(['a', 'b', 'c'])
    const result = await validateBody(req, arraySchema)
    expect(result).toEqual(['a', 'b', 'c'])
  })

  // 2. Invalid JSON throws ValidationError with correct message
  it('throws ValidationError for invalid JSON', async () => {
    const req = makeRawRequest('not-json{{{')
    await expect(validateBody(req, schema)).rejects.toThrow(ValidationError)
    await expect(
      validateBody(makeRawRequest('{broken'), schema)
    ).rejects.toThrow('Invalid JSON in request body')
  })

  it('throws ValidationError for empty body', async () => {
    const req = makeRawRequest('')
    await expect(validateBody(req, schema)).rejects.toThrow(ValidationError)
  })

  it('the invalid JSON error is a ValidationError instance', async () => {
    const req = makeRawRequest('not json')
    try {
      await validateBody(req, schema)
      expect.fail('should have thrown')
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).message).toBe('Invalid JSON in request body')
    }
  })

  // 3. Schema validation failures include field errors with paths
  it('throws ValidationError with field errors for invalid fields', async () => {
    const req = makeRequest({ name: 123, age: -5 })
    try {
      await validateBody(req, schema)
      expect.fail('should have thrown')
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ValidationError)
      const details = (error as ValidationError).details as { fields: Record<string, string[]> }
      expect(details.fields).toBeDefined()
      expect(details.fields['name']).toBeDefined()
      expect(details.fields['name'].length).toBeGreaterThan(0)
      expect(details.fields['age']).toBeDefined()
      expect(details.fields['age'].length).toBeGreaterThan(0)
    }
  })

  it('includes the message "Validation failed" for schema errors', async () => {
    const req = makeRequest({ name: 42 })
    await expect(validateBody(req, schema)).rejects.toThrow('Validation failed')
  })

  it('missing required fields are reported', async () => {
    const req = makeRequest({})
    try {
      await validateBody(req, schema)
      expect.fail('should have thrown')
    } catch (error: unknown) {
      const details = (error as ValidationError).details as { fields: Record<string, string[]> }
      expect(details.fields['name']).toBeDefined()
      expect(details.fields['age']).toBeDefined()
    }
  })

  // 4. Nested object field paths (e.g., 'address.city')
  it('reports nested field paths with dot notation', async () => {
    const nestedSchema = z.object({
      address: z.object({
        city: z.string(),
        zip: z.string().min(5),
      }),
    })
    const req = makeRequest({ address: { city: 123, zip: 'ab' } })
    try {
      await validateBody(req, nestedSchema)
      expect.fail('should have thrown')
    } catch (error: unknown) {
      const details = (error as ValidationError).details as { fields: Record<string, string[]> }
      expect(details.fields['address.city']).toBeDefined()
      expect(details.fields['address.zip']).toBeDefined()
    }
  })

  it('reports deeply nested field paths', async () => {
    const deepSchema = z.object({
      level1: z.object({
        level2: z.object({
          level3: z.string(),
        }),
      }),
    })
    const req = makeRequest({ level1: { level2: { level3: 999 } } })
    try {
      await validateBody(req, deepSchema)
      expect.fail('should have thrown')
    } catch (error: unknown) {
      const details = (error as ValidationError).details as { fields: Record<string, string[]> }
      expect(details.fields['level1.level2.level3']).toBeDefined()
    }
  })

  // 5. Multiple errors on same field
  it('collects multiple errors on the same field', async () => {
    const multiErrorSchema = z.object({
      email: z.string().email().min(10),
    })
    const req = makeRequest({ email: 'bad' })
    try {
      await validateBody(req, multiErrorSchema)
      expect.fail('should have thrown')
    } catch (error: unknown) {
      const details = (error as ValidationError).details as { fields: Record<string, string[]> }
      expect(details.fields['email']).toBeDefined()
      expect(details.fields['email'].length).toBeGreaterThanOrEqual(2)
    }
  })

  // 6. Root-level errors (when path is empty, uses '_root')
  it('uses _root key for root-level validation errors', async () => {
    const unionSchema = z.union([z.string(), z.number()])
    const req = makeRequest({ not: 'a string or number' })
    try {
      await validateBody(req, unionSchema)
      expect.fail('should have thrown')
    } catch (error: unknown) {
      const details = (error as ValidationError).details as { fields: Record<string, string[]> }
      expect(details.fields['_root']).toBeDefined()
      expect(details.fields['_root'].length).toBeGreaterThan(0)
    }
  })

  it('uses _root for a literal schema mismatch', async () => {
    const literalSchema = z.literal('expected')
    const req = makeRequest('something-else')
    try {
      await validateBody(req, literalSchema)
      expect.fail('should have thrown')
    } catch (error: unknown) {
      const details = (error as ValidationError).details as { fields: Record<string, string[]> }
      expect(details.fields['_root']).toBeDefined()
    }
  })
})
