import { getDb } from '../db/client'
import { teams, teamMembers } from '../db/schema/teams'
import { loadConfig } from '../runtime/configLoader'
import { runHook } from '../runtime/hookRunner'
import { ConflictError, ForbiddenError } from '../errors/types'
import { eq, sql } from 'drizzle-orm'
import type { Team, OnTeamCreatedArgs } from './types'

/**
 * Create a new team with the current user as owner.
 */
export async function createTeam(
  ownerId: string,
  ownerEmail: string,
  name: string,
  slug: string
): Promise<Team> {
  const config = loadConfig('teams')
  const db = getDb()

  if (!config.allowTeamCreation) {
    throw new ForbiddenError('Team creation is disabled')
  }

  // Check max teams per user
  if (config.maxTeamsPerUser > 0) {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(teams)
      .where(eq(teams.ownerId, ownerId))

    if (result.count >= config.maxTeamsPerUser) {
      throw new ForbiddenError(
        `You can create a maximum of ${config.maxTeamsPerUser} teams`
      )
    }
  }

  // Normalize slug once for both uniqueness check and insert
  const normalizedSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')

  // Check slug uniqueness
  const existing = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.slug, normalizedSlug))
    .limit(1)

  if (existing.length > 0) {
    throw new ConflictError('A team with this slug already exists')
  }

  // Create team
  const [team] = await db
    .insert(teams)
    .values({
      name,
      slug: normalizedSlug,
      ownerId,
    })
    .returning()

  // Add owner as team member
  await db.insert(teamMembers).values({
    teamId: team.id,
    userId: ownerId,
    role: 'owner',
  })

  const result = toTeam(team)

  const hookArgs: OnTeamCreatedArgs = {
    team: result,
    owner: { id: ownerId, email: ownerEmail },
  }
  await runHook('onTeamCreated', hookArgs)

  return result
}

function toTeam(row: typeof teams.$inferSelect): Team {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    ownerId: row.ownerId,
    avatarUrl: row.avatarUrl,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
