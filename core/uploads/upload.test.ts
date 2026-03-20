import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockInsertReturning = vi.fn()
const mockInsertValues = vi.fn().mockReturnValue({ returning: mockInsertReturning })
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues })

const mockSelectLimit = vi.fn()
const mockSelectWhere = vi.fn().mockReturnValue({ limit: mockSelectLimit })
const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere })
const mockSelect = vi.fn().mockReturnValue({ from: mockSelectFrom })

const mockSelectOrderBy = vi.fn()
const mockListWhere = vi.fn().mockReturnValue({ orderBy: mockSelectOrderBy })
const mockListFrom = vi.fn().mockReturnValue({ where: mockListWhere })
const mockListSelect = vi.fn().mockReturnValue({ from: mockListFrom })

const mockDeleteWhere = vi.fn()
const mockDeleteFrom = vi.fn().mockReturnValue({ where: mockDeleteWhere })
const mockDbDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere })

vi.mock('../db/client', () => ({
  getDb: vi.fn(),
}))

vi.mock('../db/schema/files', () => ({
  files: {
    id: 'id',
    userId: 'userId',
    teamId: 'teamId',
    createdAt: 'createdAt',
  },
}))

vi.mock('../runtime/hookRunner', () => ({
  runHook: vi.fn(),
}))

vi.mock('../security/encryption', () => ({
  encrypt: vi.fn((v: string) => 'enc_' + v),
}))

vi.mock('./validate', () => ({
  validateFile: vi.fn(),
  sanitizeFilename: vi.fn((n: string) => n),
  isImageMimeType: vi.fn((t: string) => t.startsWith('image/')),
}))

const mockStoragePut = vi.fn().mockResolvedValue('http://localhost/file')
const mockStorageDelete = vi.fn()

vi.mock('./storage', () => ({
  getStorageProvider: vi.fn().mockReturnValue({
    put: mockStoragePut,
    delete: mockStorageDelete,
  }),
  createStorageKey: vi.fn().mockReturnValue('2024/01/uuid.png'),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ a, b })),
  and: vi.fn((...args: unknown[]) => args),
}))

vi.mock('../errors/types', () => ({
  NotFoundError: class NotFoundError extends Error {
    code = 'NOT_FOUND'
    statusCode = 404
    constructor(msg: string) {
      super(`${msg} not found`)
      this.name = 'NotFoundError'
    }
  },
  ForbiddenError: class ForbiddenError extends Error {
    code = 'FORBIDDEN'
    statusCode = 403
    constructor(msg: string) {
      super(msg)
      this.name = 'ForbiddenError'
    }
  },
}))

import { uploadFile, getFile, listFiles, deleteFile } from './upload'
import { getDb } from '../db/client'
import { runHook } from '../runtime/hookRunner'

// ── Helpers ────────────────────────────────────────────────────────────────

const fakeFileRow = {
  id: 'file-1',
  userId: 'user-1',
  teamId: null,
  filename: 'photo.png',
  filenameEncrypted: 'enc_photo.png',
  originalName: 'photo.png',
  originalNameEncrypted: 'enc_photo.png',
  mimeType: 'image/png',
  size: 1024,
  storageKey: '2024/01/uuid.png',
  storageKeyEncrypted: 'enc_2024/01/uuid.png',
  url: 'http://localhost/file',
  thumbnailUrl: 'http://localhost/file',
  metadata: {},
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('uploadFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsertReturning.mockResolvedValue([fakeFileRow])
    vi.mocked(getDb).mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      delete: mockDbDelete,
    } as unknown as ReturnType<typeof getDb>)
  })

  it('should upload a file, insert a DB record, and fire the hook', async () => {
    const data = Buffer.from('fake image data')

    const result = await uploadFile('user-1', data, 'photo.png', 'image/png')

    // Storage put was called
    expect(mockStoragePut).toHaveBeenCalledWith(
      '2024/01/uuid.png',
      data,
      'image/png'
    )

    // DB insert was called
    expect(mockInsert).toHaveBeenCalled()
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        filename: 'photo.png',
        mimeType: 'image/png',
        storageKey: '2024/01/uuid.png',
      })
    )

    // Hook was fired
    expect(runHook).toHaveBeenCalledWith(
      'onFileUploaded',
      expect.objectContaining({ userId: 'user-1' })
    )

    // Result has expected shape
    expect(result.file.id).toBe('file-1')
    expect(result.url).toBe('http://localhost/file')
    // Image should have a thumbnail URL
    expect(result.thumbnailUrl).toBe('http://localhost/file')
  })

  it('should set thumbnailUrl to null for non-image files', async () => {
    const nonImageRow = { ...fakeFileRow, mimeType: 'application/pdf', thumbnailUrl: null }
    mockInsertReturning.mockResolvedValue([nonImageRow])

    const result = await uploadFile(
      'user-1',
      Buffer.from('pdf data'),
      'doc.pdf',
      'application/pdf'
    )

    expect(result.thumbnailUrl).toBeNull()
  })

  it('should pass teamId when provided', async () => {
    const result = await uploadFile(
      'user-1',
      Buffer.from('data'),
      'photo.png',
      'image/png',
      'team-1'
    )

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 'team-1' })
    )
  })
})

describe('getFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getDb).mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      delete: mockDbDelete,
    } as unknown as ReturnType<typeof getDb>)
  })

  it('should return a file when found and user is the owner', async () => {
    mockSelectLimit.mockResolvedValue([fakeFileRow])

    const file = await getFile('file-1', 'user-1')

    expect(file.id).toBe('file-1')
    expect(file.userId).toBe('user-1')
  })

  it('should throw NotFoundError when file does not exist', async () => {
    mockSelectLimit.mockResolvedValue([])

    await expect(getFile('nonexistent', 'user-1')).rejects.toThrow(
      /not found/i
    )
  })

  it('should throw ForbiddenError when user is not the owner', async () => {
    mockSelectLimit.mockResolvedValue([fakeFileRow])

    await expect(getFile('file-1', 'other-user')).rejects.toThrow(
      /not authorized/i
    )
  })
})

describe('listFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectOrderBy.mockResolvedValue([fakeFileRow])
    vi.mocked(getDb).mockReturnValue({
      insert: mockInsert,
      select: mockListSelect,
      delete: mockDbDelete,
    } as unknown as ReturnType<typeof getDb>)
  })

  it('should list files for a user', async () => {
    const result = await listFiles('user-1')

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('file-1')
  })

  it('should list files by teamId when provided', async () => {
    const result = await listFiles('user-1', 'team-1')

    expect(result).toHaveLength(1)
    // Verify the query was made (the mock will capture the where clause)
    expect(mockListWhere).toHaveBeenCalled()
  })
})

describe('deleteFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectLimit.mockResolvedValue([fakeFileRow])
    vi.mocked(getDb).mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      delete: mockDbDelete,
    } as unknown as ReturnType<typeof getDb>)
  })

  it('should delete from storage, DB, and fire the hook', async () => {
    await deleteFile('file-1', 'user-1')

    // Storage delete was called
    expect(mockStorageDelete).toHaveBeenCalledWith('2024/01/uuid.png')

    // DB delete was called
    expect(mockDbDelete).toHaveBeenCalled()

    // Hook was fired
    expect(runHook).toHaveBeenCalledWith(
      'onFileDeleted',
      expect.objectContaining({
        fileId: 'file-1',
        userId: 'user-1',
        storageKey: '2024/01/uuid.png',
      })
    )
  })

  it('should throw when file does not exist', async () => {
    mockSelectLimit.mockResolvedValue([])

    await expect(deleteFile('nonexistent', 'user-1')).rejects.toThrow(
      /not found/i
    )
  })

  it('should throw when user is not the file owner', async () => {
    mockSelectLimit.mockResolvedValue([fakeFileRow])

    await expect(deleteFile('file-1', 'other-user')).rejects.toThrow(
      /not authorized/i
    )
  })
})
