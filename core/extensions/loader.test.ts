import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
}))

import { existsSync, readdirSync, readFileSync } from 'fs'
import { discoverExtensions, validateDependencies } from './loader'
import type { LoadedExtension } from './types'

const mockExistsSync = existsSync as ReturnType<typeof vi.fn>
const mockReaddirSync = readdirSync as ReturnType<typeof vi.fn>
const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>

function validManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'test-ext',
    name: 'Test',
    version: '1.0.0',
    main: 'index.js',
    enabled: true,
    dependencies: [],
    ...overrides,
  }
}

function makeDirent(name: string, isDir: boolean): { name: string; isDirectory: () => boolean } {
  return { name, isDirectory: () => isDir }
}

function makeLoadedExtension(overrides: Partial<LoadedExtension> & { manifest: LoadedExtension['manifest'] }): LoadedExtension {
  return {
    directory: `extensions/${overrides.manifest.id}`,
    config: null,
    initialized: false,
    ...overrides,
  }
}

describe('discoverExtensions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty when dir does not exist', () => {
    mockExistsSync.mockReturnValue(false)

    const result = discoverExtensions()

    expect(result).toEqual([])
    expect(mockExistsSync).toHaveBeenCalledWith('./extensions')
  })

  it('discovers extensions from dir', () => {
    const manifest = validManifest()

    mockExistsSync.mockImplementation((p: string) => {
      if (p === './extensions') return true
      if (p.endsWith('manifest.json')) return true
      return false
    })
    mockReaddirSync.mockReturnValue([makeDirent('test-ext', true)])
    mockReadFileSync.mockReturnValue(JSON.stringify(manifest))

    const result = discoverExtensions()

    expect(result).toHaveLength(1)
    expect(result[0].manifest.id).toBe('test-ext')
    expect(result[0].initialized).toBe(false)
  })

  it('skips non-directories', () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue([makeDirent('readme.txt', false)])

    const result = discoverExtensions()

    expect(result).toEqual([])
  })

  it('skips missing manifest', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p === './extensions') return true
      return false
    })
    mockReaddirSync.mockReturnValue([makeDirent('no-manifest', true)])

    const result = discoverExtensions()

    expect(result).toEqual([])
  })

  it('skips invalid manifest and logs error', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue([makeDirent('bad-ext', true)])
    mockReadFileSync.mockReturnValue(JSON.stringify({ id: '!!!invalid', name: '' }))

    const result = discoverExtensions()

    expect(result).toEqual([])
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid manifest'),
      expect.any(String)
    )

    consoleSpy.mockRestore()
  })

  it('skips disabled extensions', () => {
    const manifest = validManifest({ enabled: false })

    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue([makeDirent('disabled-ext', true)])
    mockReadFileSync.mockReturnValue(JSON.stringify(manifest))

    const result = discoverExtensions()

    expect(result).toEqual([])
  })

  it('sorts by dependencies', () => {
    const manifestA = validManifest({ id: 'ext-a', dependencies: ['ext-b'] })
    const manifestB = validManifest({ id: 'ext-b', dependencies: [] })

    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue([
      makeDirent('ext-a', true),
      makeDirent('ext-b', true),
    ])
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes('ext-a')) return JSON.stringify(manifestA)
      if (p.includes('ext-b')) return JSON.stringify(manifestB)
      return '{}'
    })

    const result = discoverExtensions()

    expect(result).toHaveLength(2)
    expect(result[0].manifest.id).toBe('ext-b')
    expect(result[1].manifest.id).toBe('ext-a')
  })
})

describe('validateDependencies', () => {
  it('returns empty when all deps are satisfied', () => {
    const extensions: LoadedExtension[] = [
      makeLoadedExtension({
        manifest: {
          id: 'ext-a',
          name: 'A',
          version: '1.0.0',
          description: '',
          author: '',
          main: 'index.ts',
          dependencies: ['ext-b'],
          hooks: [],
          routes: [],
          enabled: true,
        },
      }),
      makeLoadedExtension({
        manifest: {
          id: 'ext-b',
          name: 'B',
          version: '1.0.0',
          description: '',
          author: '',
          main: 'index.ts',
          dependencies: [],
          hooks: [],
          routes: [],
          enabled: true,
        },
      }),
    ]

    const errors = validateDependencies(extensions)

    expect(errors).toEqual([])
  })

  it('returns missing deps', () => {
    const extensions: LoadedExtension[] = [
      makeLoadedExtension({
        manifest: {
          id: 'ext-a',
          name: 'A',
          version: '1.0.0',
          description: '',
          author: '',
          main: 'index.ts',
          dependencies: ['ext-missing'],
          hooks: [],
          routes: [],
          enabled: true,
        },
      }),
    ]

    const errors = validateDependencies(extensions)

    expect(errors).toHaveLength(1)
    expect(errors[0].extension).toBe('ext-a')
    expect(errors[0].missing).toEqual(['ext-missing'])
  })
})
