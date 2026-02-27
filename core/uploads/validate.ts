import { loadConfig } from '../runtime/configLoader'
import { ValidationError } from '../errors/types'

interface FileValidation {
  name: string
  size: number
  type: string
}

/**
 * Validate a file against upload config constraints.
 */
export function validateFile(file: FileValidation): void {
  const config = loadConfig('uploads')
  const errors: Array<{ field: string; message: string }> = []

  // Check file size
  if (file.size > config.maxFileSize) {
    const maxMB = Math.round(config.maxFileSize / (1024 * 1024))
    errors.push({
      field: 'file',
      message: `File size exceeds ${maxMB}MB limit`,
    })
  }

  // Check file size is non-zero
  if (file.size === 0) {
    errors.push({
      field: 'file',
      message: 'File is empty',
    })
  }

  // Check MIME type
  if (config.allowedMimeTypes.length > 0) {
    if (!config.allowedMimeTypes.includes(file.type)) {
      errors.push({
        field: 'file',
        message: `File type ${file.type} is not allowed. Allowed types: ${config.allowedMimeTypes.join(', ')}`,
      })
    }
  }

  // Check filename
  if (!file.name || file.name.length === 0) {
    errors.push({
      field: 'file',
      message: 'Filename is required',
    })
  }

  // Sanitize filename — reject path traversal attempts
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    errors.push({
      field: 'file',
      message: 'Invalid filename',
    })
  }

  if (errors.length > 0) {
    throw new ValidationError('File validation failed', errors)
  }
}

/**
 * Check if a MIME type is an image type.
 */
export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

/**
 * Sanitize a filename for storage.
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._]/, '')
    .slice(0, 200)
}
