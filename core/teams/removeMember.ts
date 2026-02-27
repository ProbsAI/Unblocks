import { eq, and } from 'drizzle-orm'
import { getDb } from '../db/client'
import { teams, teamMembers } from '../db/schema/teams'
import { runHook } from '../runtime/hookRunner'
import { ForbiddenError, NotFoundError } from '../errors/types'
import { getUserTeamRole } from './getTeam'
import type { TeamRole, OnTeamMemberRemovedArgs } from './types'

/**
 * Remove a member from a team.
 */
export async function removeMember(
  teamId: string,
  targetUserId: string,
  removedBy: string
): Promise<void> {
  const db = getDb()

  // Check remover has permission
  const removerRole = await getUserTeamRole(teamId, removedBy)
  if (!removerRole || !canRemove(removerRole)) {
    throw new ForbiddenError('Not authorized to remove members')
  }

  // Cannot remove self if owner
  const targetRole = await getUserTeamRole(teamId, targetUserId)
  if (!targetRole) {
    throw new NotFoundError('User is not a member of this team')
  }

  if (targetRole === 'owner') {
    throw new ForbiddenError('Cannot remove the team owner')
  }

  // Admins cannot remove other admins
  if (removerRole === 'admin' && targetRole === 'admin') {
    throw new ForbiddenError('Admins cannot remove other admins')
  }

  await db
    .delete(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, targetUserId)
      )
    )

  const hookArgs: OnTeamMemberRemovedArgs = {
    teamId,
    userId: targetUserId,
    removedBy,
  }
  await runHook('onTeamMemberRemoved', hookArgs)
}

/**
 * Leave a team (remove yourself).
 */
export async function leaveTeam(
  teamId: string,
  userId: string
): Promise<void> {
  const db = getDb()

  // Check if user is the owner
  const [team] = await db
    .select({ ownerId: teams.ownerId })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1)

  if (!team) {
    throw new NotFoundError('Team not found')
  }

  if (team.ownerId === userId) {
    throw new ForbiddenError('Owner cannot leave the team. Transfer ownership first.')
  }

  await db
    .delete(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, userId)
      )
    )
}

function canRemove(role: TeamRole): boolean {
  return role === 'owner' || role === 'admin'
}
