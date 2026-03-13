import { eq, desc } from 'drizzle-orm'
import { getDb } from '../../core/db/client'
import { datasets } from './schema'
import type { Dataset } from './types'

/**
 * Create a new dataset.
 */
export async function createDataset(
  userId: string,
  data: {
    name: string
    description?: string
    sourceId?: string
    pipelineId?: string
    teamId?: string
    schema?: Record<string, string>
  }
): Promise<Dataset> {
  const db = getDb()

  const [row] = await db
    .insert(datasets)
    .values({
      userId,
      teamId: data.teamId ?? null,
      name: data.name,
      description: data.description ?? '',
      sourceId: data.sourceId ?? null,
      pipelineId: data.pipelineId ?? null,
      schema: data.schema ?? {},
    })
    .returning()

  return toDataset(row)
}

/**
 * List datasets for a user.
 */
export async function listDatasets(userId: string): Promise<Dataset[]> {
  const db = getDb()

  const rows = await db
    .select()
    .from(datasets)
    .where(eq(datasets.userId, userId))
    .orderBy(desc(datasets.createdAt))

  return rows.map(toDataset)
}

/**
 * Get a dataset by ID.
 */
export async function getDataset(id: string): Promise<Dataset | null> {
  const db = getDb()

  const rows = await db
    .select()
    .from(datasets)
    .where(eq(datasets.id, id))
    .limit(1)

  return rows.length > 0 ? toDataset(rows[0]) : null
}

/**
 * Delete a dataset.
 */
export async function deleteDataset(id: string): Promise<void> {
  const db = getDb()
  await db.delete(datasets).where(eq(datasets.id, id))
}

function toDataset(row: typeof datasets.$inferSelect): Dataset {
  return {
    id: row.id,
    userId: row.userId,
    teamId: row.teamId,
    name: row.name,
    description: row.description ?? '',
    sourceId: row.sourceId,
    pipelineId: row.pipelineId,
    rowCount: row.rowCount,
    sizeBytes: row.sizeBytes,
    schema: (row.schema ?? {}) as Record<string, string>,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
