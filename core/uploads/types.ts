import { z } from 'zod'

export const UploadsConfigSchema = z.object({
  /** Enable file upload system */
  enabled: z.boolean().default(true),

  /** Storage backend */
  storage: z.enum(['local', 's3']).default('local'),

  /** Local storage directory */
  localDir: z.string().default('./uploads'),

  /** S3-compatible settings */
  s3: z.object({
    bucket: z.string().default(''),
    region: z.string().default('us-east-1'),
    endpoint: z.string().optional(),
    accessKeyId: z.string().default(''),
    secretAccessKey: z.string().default(''),
  }).default({}),

  /** Max file size in bytes (default 10MB) */
  maxFileSize: z.number().default(10 * 1024 * 1024),

  /** Allowed MIME types (empty = allow all) */
  allowedMimeTypes: z.array(z.string()).default([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/csv',
  ]),

  /** Image processing */
  images: z.object({
    /** Max width for auto-resize (0 = no resize) */
    maxWidth: z.number().default(2048),
    /** Max height for auto-resize (0 = no resize) */
    maxHeight: z.number().default(2048),
    /** Quality for JPEG/WebP (1-100) */
    quality: z.number().min(1).max(100).default(85),
    /** Generate thumbnails */
    thumbnails: z.boolean().default(true),
    /** Thumbnail size */
    thumbnailSize: z.number().default(200),
  }).default({}),
})

export type UploadsConfig = z.infer<typeof UploadsConfigSchema>

export interface FileRecord {
  id: string
  userId: string
  teamId: string | null
  filename: string
  originalName: string
  mimeType: string
  size: number
  storageKey: string
  url: string | null
  thumbnailUrl: string | null
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface UploadResult {
  file: FileRecord
  url: string
  thumbnailUrl: string | null
}

export interface OnFileUploadedArgs {
  file: FileRecord
  userId: string
}

export interface OnFileDeletedArgs {
  fileId: string
  userId: string
  storageKey: string
}
