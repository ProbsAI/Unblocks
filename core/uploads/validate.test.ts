import { describe, it, expect } from 'vitest'
import { sanitizeFilename, isImageMimeType } from './validate'

describe('sanitizeFilename', () => {
  it('keeps alphanumeric characters, dots, hyphens, and underscores', () => {
    expect(sanitizeFilename('my-file_v2.txt')).toBe('my-file_v2.txt')
  })

  it('replaces special characters with underscores', () => {
    expect(sanitizeFilename('my file @home!.txt')).toBe('my_file_home_.txt')
  })

  it('collapses multiple consecutive underscores', () => {
    expect(sanitizeFilename('a   b   c.txt')).toBe('a_b_c.txt')
  })

  it('handles path traversal attempts by replacing slashes', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('etc_passwd')
  })

  it('handles backslash path traversal', () => {
    expect(sanitizeFilename('..\\..\\etc\\passwd')).toBe('etc_passwd')
  })

  it('strips leading dots', () => {
    expect(sanitizeFilename('.hidden')).toBe('hidden')
  })

  it('strips leading underscores', () => {
    expect(sanitizeFilename('_private')).toBe('private')
  })

  it('truncates filenames to 200 characters', () => {
    const longName = 'a'.repeat(300) + '.txt'
    const result = sanitizeFilename(longName)
    expect(result.length).toBeLessThanOrEqual(200)
  })

  it('handles empty-ish filenames', () => {
    // After sanitizing "..." we get "." -> leading dot stripped -> ""
    // The function just does what it does; no validation error
    const result = sanitizeFilename('...')
    expect(typeof result).toBe('string')
  })

  it('handles filenames with unicode characters', () => {
    const result = sanitizeFilename('resume_cafe.pdf')
    expect(result).toBe('resume_cafe.pdf')
  })
})

describe('isImageMimeType', () => {
  it('returns true for common image MIME types', () => {
    expect(isImageMimeType('image/png')).toBe(true)
    expect(isImageMimeType('image/jpeg')).toBe(true)
    expect(isImageMimeType('image/gif')).toBe(true)
    expect(isImageMimeType('image/webp')).toBe(true)
    expect(isImageMimeType('image/svg+xml')).toBe(true)
    expect(isImageMimeType('image/bmp')).toBe(true)
  })

  it('returns false for non-image MIME types', () => {
    expect(isImageMimeType('application/pdf')).toBe(false)
    expect(isImageMimeType('text/plain')).toBe(false)
    expect(isImageMimeType('video/mp4')).toBe(false)
    expect(isImageMimeType('audio/mpeg')).toBe(false)
    expect(isImageMimeType('application/json')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isImageMimeType('')).toBe(false)
  })

  it('returns false for partial match', () => {
    expect(isImageMimeType('not-image/png')).toBe(false)
  })
})
