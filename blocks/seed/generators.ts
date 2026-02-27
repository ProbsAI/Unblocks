/**
 * Seed Block — Data Generators
 *
 * Generates realistic-looking sample data for development.
 * Uses deterministic sequences for reproducibility.
 */

const firstNames = [
  'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry',
  'Iris', 'Jack', 'Kate', 'Leo', 'Mia', 'Noah', 'Olivia', 'Pete',
  'Quinn', 'Rosa', 'Sam', 'Tina', 'Uma', 'Victor', 'Wendy', 'Xander',
]

const lastNames = [
  'Smith', 'Johnson', 'Brown', 'Taylor', 'Anderson', 'Wilson', 'Martinez',
  'Garcia', 'Lee', 'Clark', 'Hall', 'Young', 'King', 'Wright', 'Lopez',
  'Scott', 'Green', 'Adams', 'Baker', 'Hill', 'Nelson', 'Moore', 'Mitchell',
]

const teamNames = [
  'Engineering', 'Design', 'Marketing', 'Sales', 'Product', 'Support',
  'Data Science', 'DevOps', 'Research', 'Growth', 'Infrastructure', 'QA',
]

const teamSlugs = teamNames.map((n) => n.toLowerCase().replace(/\s+/g, '-'))

const jobTypes = [
  'send-welcome-email', 'process-upload', 'generate-report',
  'sync-billing', 'cleanup-sessions', 'send-notification',
  'export-data', 'import-data', 'resize-image', 'backup-database',
]

const notificationTitles = [
  'Welcome to the platform',
  'New team member joined',
  'Your report is ready',
  'Payment received',
  'Password changed',
  'File uploaded successfully',
  'Plan upgraded',
  'New comment on your post',
  'Weekly digest',
  'System maintenance scheduled',
]

const mimeTypes = [
  'image/png', 'image/jpeg', 'application/pdf',
  'text/csv', 'application/json', 'image/svg+xml',
]

let seedCounter = 0

function pick<T>(arr: T[]): T {
  return arr[seedCounter++ % arr.length]
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function generateEmail(index: number): string {
  const first = firstNames[index % firstNames.length].toLowerCase()
  const last = lastNames[index % lastNames.length].toLowerCase()
  return `${first}.${last}${index}@example.com`
}

export function generateUserName(index: number): string {
  return `${firstNames[index % firstNames.length]} ${lastNames[index % lastNames.length]}`
}

export function generateTeamName(index: number): string {
  if (index < teamNames.length) return teamNames[index]
  return `${pick(teamNames)} ${index}`
}

export function generateTeamSlug(index: number): string {
  if (index < teamSlugs.length) return teamSlugs[index]
  return `${teamSlugs[index % teamSlugs.length]}-${index}`
}

export function generateJobType(): string {
  return pickRandom(jobTypes)
}

export function generateJobPayload(type: string): Record<string, unknown> {
  return { type, generatedAt: new Date().toISOString(), data: { seed: true } }
}

export function generateNotificationTitle(): string {
  return pickRandom(notificationTitles)
}

export function generateNotificationBody(title: string): string {
  return `${title}. This is a seeded notification for development.`
}

export function generateNotificationCategory(): string {
  return pickRandom(['general', 'billing', 'teams', 'system'])
}

export function generateFileName(index: number): string {
  const names = ['report', 'avatar', 'document', 'screenshot', 'export', 'backup']
  const extensions = ['png', 'jpg', 'pdf', 'csv', 'json']
  return `${names[index % names.length]}-${index}.${extensions[index % extensions.length]}`
}

export function generateFileMimeType(filename: string): string {
  const ext = filename.split('.').pop()
  const map: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', pdf: 'application/pdf',
    csv: 'text/csv', json: 'application/json', svg: 'image/svg+xml',
  }
  return map[ext ?? ''] ?? 'application/octet-stream'
}

export function generateFileSize(): number {
  return Math.floor(Math.random() * 5_000_000) + 1_000
}

export function resetSeedCounter(): void {
  seedCounter = 0
}
