import type { ZodSchema, ZodError } from 'zod'
import { ValidationError } from '../errors/types'

export async function validateBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<T> {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    throw new ValidationError('Invalid JSON in request body')
  }

  const result = schema.safeParse(body)

  if (!result.success) {
    const fieldErrors = formatZodErrors(result.error)
    throw new ValidationError('Validation failed', { fields: fieldErrors })
  }

  return result.data
}

function formatZodErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {}

  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root'
    if (!fieldErrors[path]) {
      fieldErrors[path] = []
    }
    fieldErrors[path].push(issue.message)
  }

  return fieldErrors
}
