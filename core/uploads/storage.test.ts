import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../runtime/configLoader', () => ({
  loadConfig: vi.fn().mockReturnValue({
    storage: 'local',
    localDir: './test-uploads',
    s3: { bucket: '', region: 'us-east-1' },
  }),
}))

vi.mock('../env', () => ({
  getEnv: vi.fn().mockReturnValue({ APP_URL: 'http://localhost:3000' }),
}))

import { createStorageKey, getStorageProvider } from './storage'
import { loadConfig } from '../runtime/configLoader'

describe('createStorageKey', () => {
  it('should create a key with YYYY/MM/uuid.ext pattern', () => {
    const key = createStorageKey('photo.png')
    const parts = key.split('/')

    expect(parts).toHaveLength(3)

    const year = parts[0]
    const month = parts[1]
    const file = parts[2]

    // Year should be 4 digits
    expect(year).toMatch(/^\d{4}$/)

    // Month should be 2 digits zero-padded
    expect(month).toMatch(/^\d{2}$/)
    const monthNum = parseInt(month, 10)
    expect(monthNum).toBeGreaterThanOrEqual(1)
    expect(monthNum).toBeLessThanOrEqual(12)

    // File should be uuid.ext
    expect(file).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/
    )
  })

  it('should preserve the file extension', () => {
    const key = createStorageKey('document.pdf')
    expect(key).toMatch(/\.pdf$/)
  })

  it('should handle files without an extension', () => {
    const key = createStorageKey('README')
    const parts = key.split('/')
    // No dot in the filename portion
    expect(parts[2]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })

  it('should generate unique keys for the same filename', () => {
    const key1 = createStorageKey('file.txt')
    const key2 = createStorageKey('file.txt')
    expect(key1).not.toBe(key2)
  })

  it('should use the last segment as extension for multi-dot filenames', () => {
    const key = createStorageKey('my.archive.tar.gz')
    expect(key).toMatch(/\.gz$/)
  })
})

describe('getStorageProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return a local provider with put/get/delete/getUrl methods', () => {
    const provider = getStorageProvider()

    expect(provider).toBeDefined()
    expect(typeof provider.put).toBe('function')
    expect(typeof provider.get).toBe('function')
    expect(typeof provider.delete).toBe('function')
    expect(typeof provider.getUrl).toBe('function')
  })

  it('should return a local provider when storage is "local"', () => {
    const provider = getStorageProvider()
    const url = provider.getUrl('2024/01/test-id.png')
    expect(url).toBe('http://localhost:3000/api/uploads/serve/2024/01/test-id.png')
  })

  it('should return an S3 provider when storage is "s3"', () => {
    vi.mocked(loadConfig).mockReturnValue({
      storage: 's3',
      localDir: './test-uploads',
      s3: { bucket: 'my-bucket', region: 'us-west-2' },
    })

    const provider = getStorageProvider()

    expect(provider).toBeDefined()
    expect(typeof provider.put).toBe('function')
    expect(typeof provider.get).toBe('function')
    expect(typeof provider.delete).toBe('function')
    expect(typeof provider.getUrl).toBe('function')

    const url = provider.getUrl('2024/01/test-id.png')
    expect(url).toBe(
      'https://my-bucket.s3.us-west-2.amazonaws.com/2024/01/test-id.png'
    )
  })
})
