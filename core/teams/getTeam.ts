import { eq, and } from 'drizzle-orm'
import { getDb } from '../db/client'
import { teams, teamMembers } from '../db/schema/teams'
import { users } from '../db/schema/users'
import { NotFoundError } from '../errors/types'
import type { Team, TeamMember, TeamRole } from './types'

/**
 * Get a team by ID.
 */
export async function getTeam(teamId: string): Promise<Team> {
  const db = getDb()

  const rows = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1)

  if (rows.length === 0) {
    throw new NotFoundError('Team not found')
  }

  return toTeam(rows[0])
}

/**
 * Get a team by slug.
 */
export async function getTeamBySlug(slug: string): Promise<Team> {
  const db = getDb()

  const rows = await db
    .select()
    .from(teams)
    .where(eq(teams.slug, slug))
    .limit(1)

  if (rows.length === 0) {
    throw new NotFoundError('Team not found')
  }

  return toTeam(rows[0])
}

/**
 * Get all teams a user belongs to.
 */
export async function getUserTeams(userId: string): Promise<Array<Team & { role: TeamRole }>> {
  const db = getDb()

  const rows = await db
    .select({
      team: teams,
      role: teamMembers.role,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, userId))

  return rows.map((row) => ({
    ...toTeam(row.team),
    role: row.role as TeamRole,
  }))
}

/**
 * Get all members of a team.
 */
export async function getTeamMembers(
  teamId: string
): Promise<Array<TeamMember & { email: string; name: string | null }>> {
  const db = getDb()

  const rows = await db
    .select({
      member: teamMembers,
      email: users.email,
      name: users.name,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, teamId))

  return rows.map((row) => ({
    id: row.member.id,
    teamId: row.member.teamId,
    userId: row.member.userId,
    role: row.member.role as TeamRole,
    joinedAt: row.member.joinedAt,
    email: row.email,
    name: row.name,
  }))
}

/**
 * Get a user's role in a team. Returns null if not a member.
 */
export async function getUserTeamRole(
  teamId: string,
  userId: string
): Promise<TeamRole | null> {
  const db = getDb()

  const rows = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, userId)
      )
    )
    .limit(1)

  return rows.length > 0 ? (rows[0].role as TeamRole) : null
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
