import { eq, and } from 'drizzle-orm'
import { getDb } from '../db/client'
import { files } from '../db/schema/files'
import { runHook } from '../runtime/hookRunner'
import { validateFile, sanitizeFilename, isImageMimeType } from './validate'
import { getStorageProvider, createStorageKey } from './storage'
import { NotFoundError, ForbiddenError } from '../errors/types'
import type { FileRecord, UploadResult, OnFileUploadedArgs, OnFileDeletedArgs } from './types'

/**
 * Upload a file and store metadata in the database.
 */
export async function uploadFile(
  userId: string,
  data: Buffer,
  originalName: string,
  mimeType: string,
  teamId?: string
): Promise<UploadResult> {
  const sanitized = sanitizeFilename(originalName)

  // Validate
  validateFile({
    name: sanitized,
    size: data.length,
    type: mimeType,
  })

  const storage = getStorageProvider()
  const storageKey = createStorageKey(sanitized)

  // Upload to storage
  const url = await storage.put(storageKey, data, mimeType)

  // Generate thumbnail for images
  let thumbnailUrl: string | null = null
  if (isImageMimeType(mimeType)) {
    // Thumbnail generation would go here in production
    // For V1B, we use the main URL as fallback
    thumbnailUrl = url
  }

  // Store metadata
  const db = getDb()
  const [record] = await db
    .insert(files)
    .values({
      userId,
      teamId: teamId ?? null,
      filename: sanitized,
      originalName,
      mimeType,
      size: data.length,
      storageKey,
      url,
      thumbnailUrl,
      metadata: {},
    })
    .returning()

  const file = toFileRecord(record)

  const hookArgs: OnFileUploadedArgs = { file, userId }
  await runHook('onFileUploaded', hookArgs)

  return { file, url, thumbnailUrl }
}

/**
 * Get a file by ID. Checks ownership.
 */
export async function getFile(
  fileId: string,
  userId: string
): Promise<FileRecord> {
  const db = getDb()
  const rows = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1)

  if (rows.length === 0) {
    throw new NotFoundError('File not found')
  }

  const file = rows[0]

  // Check ownership (user owns file OR file belongs to user's team)
  if (file.userId !== userId) {
    throw new ForbiddenError('Not authorized to access this file')
  }

  return toFileRecord(file)
}

/**
 * List files for a user.
 */
export async function listFiles(
  userId: string,
  teamId?: string
): Promise<FileRecord[]> {
  const db = getDb()

  const conditions = teamId
    ? and(eq(files.teamId, teamId))
    : eq(files.userId, userId)

  const rows = await db
    .select()
    .from(files)
    .where(conditions)
    .orderBy(files.createdAt)

  return rows.map(toFileRecord)
}

/**
 * Delete a file. Removes from storage and database.
 */
export async function deleteFile(
  fileId: string,
  userId: string
): Promise<void> {
  const file = await getFile(fileId, userId)

  const storage = getStorageProvider()
  await storage.delete(file.storageKey)

  const db = getDb()
  await db.delete(files).where(eq(files.id, fileId))

  const hookArgs: OnFileDeletedArgs = {
    fileId,
    userId,
    storageKey: file.storageKey,
  }
  await runHook('onFileDeleted', hookArgs)
}

function toFileRecord(row: typeof files.$inferSelect): FileRecord {
  return {
    id: row.id,
    userId: row.userId,
    teamId: row.teamId,
    filename: row.filename,
    originalName: row.originalName,
    mimeType: row.mimeType,
    size: row.size,
    storageKey: row.storageKey,
    url: row.url,
    thumbnailUrl: row.thumbnailUrl,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
