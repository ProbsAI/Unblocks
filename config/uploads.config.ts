import type { UploadsConfig } from '@unblocks/core/uploads/types'

const config: UploadsConfig = {
  enabled: true,
  storage: 'local',
  localDir: './uploads',
  s3: {
    bucket: '',
    region: 'us-east-1',
    accessKeyId: '',
    secretAccessKey: '',
  },
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/csv',
  ],
  images: {
    maxWidth: 2048,
    maxHeight: 2048,
    quality: 85,
    thumbnails: true,
    thumbnailSize: 200,
  },
}

export default config
