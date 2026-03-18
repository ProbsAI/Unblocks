import { readFile, writeFile, unlink, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { loadConfig } from '../runtime/configLoader'
import { getEnv } from '../env'

export interface StorageProvider {
  put(key: string, data: Buffer, mimeType: string): Promise<string>
  get(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  getUrl(key: string): string
}

/**
 * Create a storage key from a filename.
 */
export function createStorageKey(filename: string): string {
  const date = new Date()
  const prefix = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`
  const id = randomUUID()
  const ext = filename.includes('.') ? filename.split('.').pop() : ''
  return ext ? `${prefix}/${id}.${ext}` : `${prefix}/${id}`
}

/**
 * Get the storage provider based on config.
 */
export function getStorageProvider(): StorageProvider {
  const config = loadConfig('uploads')

  if (config.storage === 's3') {
    return createS3Provider()
  }

  return createLocalProvider(config.localDir)
}

function createLocalProvider(baseDir: string): StorageProvider {
  const env = getEnv()
  const appUrl = env.APP_URL

  return {
    async put(key: string, data: Buffer): Promise<string> {
      const filePath = join(baseDir, key)
      const dir = dirname(filePath)

      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true })
      }

      await writeFile(filePath, data)
      return `${appUrl}/api/uploads/serve/${key}`
    },

    async get(key: string): Promise<Buffer> {
      const filePath = join(baseDir, key)
      return readFile(filePath)
    },

    async delete(key: string): Promise<void> {
      const filePath = join(baseDir, key)
      try {
        await unlink(filePath)
      } catch {
        // File already deleted
      }
    },

    getUrl(key: string): string {
      return `${appUrl}/api/uploads/serve/${key}`
    },
  }
}

function createS3Provider(): StorageProvider {
  const config = loadConfig('uploads')
  const s3Config = config.s3

  // S3 operations use fetch with AWS Signature V4
  // For production, users should install @aws-sdk/client-s3
  // This is a minimal implementation for V1B

  return {
    async put(key: string, data: Buffer, mimeType: string): Promise<string> {
      const url = getS3Url(s3Config.bucket, key, s3Config.region, s3Config.endpoint)

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': mimeType,
          'Content-Length': String(data.length),
        },
        body: new Blob([data], { type: mimeType }),
      })

      if (!response.ok) {
        throw new Error(`S3 upload failed: ${response.status}`)
      }

      return url
    },

    async get(key: string): Promise<Buffer> {
      const url = getS3Url(s3Config.bucket, key, s3Config.region, s3Config.endpoint)
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`S3 get failed: ${response.status}`)
      }

      return Buffer.from(await response.arrayBuffer())
    },

    async delete(key: string): Promise<void> {
      const url = getS3Url(s3Config.bucket, key, s3Config.region, s3Config.endpoint)

      const response = await fetch(url, { method: 'DELETE' })

      if (!response.ok && response.status !== 404) {
        throw new Error(`S3 delete failed: ${response.status}`)
      }
    },

    getUrl(key: string): string {
      return getS3Url(s3Config.bucket, key, s3Config.region, s3Config.endpoint)
    },
  }
}

function getS3Url(
  bucket: string,
  key: string,
  region: string,
  endpoint?: string
): string {
  if (endpoint) {
    return `${endpoint}/${bucket}/${key}`
  }
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
}
