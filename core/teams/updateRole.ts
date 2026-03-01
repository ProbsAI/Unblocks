import { eq, and } from 'drizzle-orm'
import { getDb } from '../db/client'
import { teams, teamMembers } from '../db/schema/teams'
import { ForbiddenError, NotFoundError } from '../errors/types'
import { getUserTeamRole } from './getTeam'
import type { TeamRole } from './types'

/**
 * Update a team member's role.
 */
export async function updateMemberRole(
  teamId: string,
  targetUserId: string,
  newRole: TeamRole,
  updatedBy: string
): Promise<void> {
  const db = getDb()

  // Only owner can change roles
  const updaterRole = await getUserTeamRole(teamId, updatedBy)
  if (updaterRole !== 'owner') {
    throw new ForbiddenError('Only the team owner can change roles')
  }

  // Cannot change own role
  if (targetUserId === updatedBy) {
    throw new ForbiddenError('Cannot change your own role')
  }

  // Cannot assign owner role (use transferOwnership instead)
  if (newRole === 'owner') {
    throw new ForbiddenError('Use transferOwnership to transfer team ownership')
  }

  const targetRole = await getUserTeamRole(teamId, targetUserId)
  if (!targetRole) {
    throw new NotFoundError('User is not a member of this team')
  }

  await db
    .update(teamMembers)
    .set({ role: newRole })
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, targetUserId)
      )
    )
}

/**
 * Transfer team ownership to another member.
 */
export async function transferOwnership(
  teamId: string,
  newOwnerId: string,
  currentOwnerId: string
): Promise<void> {
  const db = getDb()

  // Must be current owner
  const currentRole = await getUserTeamRole(teamId, currentOwnerId)
  if (currentRole !== 'owner') {
    throw new ForbiddenError('Only the team owner can transfer ownership')
  }

  // New owner must be a member
  const newOwnerRole = await getUserTeamRole(teamId, newOwnerId)
  if (!newOwnerRole) {
    throw new NotFoundError('User is not a member of this team')
  }

  // Update team owner
  await db
    .update(teams)
    .set({ ownerId: newOwnerId, updatedAt: new Date() })
    .where(eq(teams.id, teamId))

  // Update roles
  await db
    .update(teamMembers)
    .set({ role: 'owner' })
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, newOwnerId)
      )
    )

  await db
    .update(teamMembers)
    .set({ role: 'admin' })
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, currentOwnerId)
      )
    )
}
