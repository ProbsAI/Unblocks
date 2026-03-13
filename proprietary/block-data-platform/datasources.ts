import { eq, desc } from 'drizzle-orm'
import { getDb } from '../../core/db/client'
import { dataSources } from './schema'
import type { DataSource, DataSourceType } from './types'

/**
 * Create a new data source.
 */
export async function createDataSource(
  userId: string,
  data: {
    name: string
    type: DataSourceType
    config: Record<string, unknown>
  }
): Promise<DataSource> {
  const db = getDb()

  const [row] = await db
    .insert(dataSources)
    .values({
      userId,
      name: data.name,
      type: data.type,
      config: data.config,
    })
    .returning()

  return toDataSource(row)
}

/**
 * List data sources for a user.
 */
export async function listDataSources(userId: string): Promise<DataSource[]> {
  const db = getDb()

  const rows = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.userId, userId))
    .orderBy(desc(dataSources.createdAt))

  return rows.map(toDataSource)
}

/**
 * Get a data source by ID.
 */
export async function getDataSource(id: string): Promise<DataSource | null> {
  const db = getDb()

  const rows = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.id, id))
    .limit(1)

  return rows.length > 0 ? toDataSource(rows[0]) : null
}

/**
 * Delete a data source.
 */
export async function deleteDataSource(id: string): Promise<void> {
  const db = getDb()
  await db.delete(dataSources).where(eq(dataSources.id, id))
}

function toDataSource(row: typeof dataSources.$inferSelect): DataSource {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    type: row.type as DataSourceType,
    config: (row.config ?? {}) as Record<string, unknown>,
    lastSyncAt: row.lastSyncAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
