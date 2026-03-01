import { eq, and, sql } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { getDb } from '../db/client'
import { teamMembers, teamInvitations } from '../db/schema/teams'
import { loadConfig } from '../runtime/configLoader'
import { runHook } from '../runtime/hookRunner'
import { ConflictError, ForbiddenError, NotFoundError } from '../errors/types'
import { getUserTeamRole } from './getTeam'
import type { TeamInvitation, TeamRole, OnTeamMemberAddedArgs } from './types'

/**
 * Invite a user to a team by email.
 */
export async function inviteMember(
  teamId: string,
  email: string,
  role: TeamRole,
  invitedBy: string
): Promise<TeamInvitation> {
  const config = loadConfig('teams')
  const db = getDb()

  // Check inviter has permission
  const inviterRole = await getUserTeamRole(teamId, invitedBy)
  if (!inviterRole || !canInvite(inviterRole)) {
    throw new ForbiddenError('Not authorized to invite members')
  }

  // Cannot invite as owner
  if (role === 'owner') {
    throw new ForbiddenError('Cannot invite someone as owner')
  }

  // Check max members
  if (config.maxMembersPerTeam > 0) {
    const members = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId))

    if (members.length >= config.maxMembersPerTeam) {
      throw new ForbiddenError(
        `Team has reached the maximum of ${config.maxMembersPerTeam} members`
      )
    }
  }

  // Check if already invited (pending — not yet accepted or expired)
  const existingInvite = await db
    .select({ id: teamInvitations.id })
    .from(teamInvitations)
    .where(
      and(
        eq(teamInvitations.teamId, teamId),
        eq(teamInvitations.email, email.toLowerCase()),
        sql`${teamInvitations.acceptedAt} IS NULL`,
        sql`${teamInvitations.expiresAt} > NOW()`,
      )
    )
    .limit(1)

  if (existingInvite.length > 0) {
    throw new ConflictError('User has already been invited')
  }

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(
    Date.now() + config.invitationExpiryHours * 60 * 60 * 1000
  )

  const [invitation] = await db
    .insert(teamInvitations)
    .values({
      teamId,
      email: email.toLowerCase(),
      role,
      invitedBy,
      token,
      expiresAt,
    })
    .returning()

  return toInvitation(invitation)
}

/**
 * Accept a team invitation by token.
 */
export async function acceptInvitation(
  token: string,
  userId: string
): Promise<void> {
  const db = getDb()

  const rows = await db
    .select()
    .from(teamInvitations)
    .where(eq(teamInvitations.token, token))
    .limit(1)

  if (rows.length === 0) {
    throw new NotFoundError('Invitation not found')
  }

  const invitation = rows[0]

  if (invitation.acceptedAt) {
    throw new ConflictError('Invitation has already been accepted')
  }

  if (new Date() > invitation.expiresAt) {
    throw new ForbiddenError('Invitation has expired')
  }

  // Check if already a member
  const existing = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, invitation.teamId),
        eq(teamMembers.userId, userId)
      )
    )
    .limit(1)

  if (existing.length > 0) {
    throw new ConflictError('Already a member of this team')
  }

  // Add as member
  await db.insert(teamMembers).values({
    teamId: invitation.teamId,
    userId,
    role: invitation.role,
  })

  // Mark invitation as accepted
  await db
    .update(teamInvitations)
    .set({ acceptedAt: new Date() })
    .where(eq(teamInvitations.id, invitation.id))

  const hookArgs: OnTeamMemberAddedArgs = {
    teamId: invitation.teamId,
    userId,
    role: invitation.role as TeamRole,
    invitedBy: invitation.invitedBy,
  }
  await runHook('onTeamMemberAdded', hookArgs)
}

/**
 * Get pending invitations for a team.
 */
export async function getTeamInvitations(
  teamId: string
): Promise<TeamInvitation[]> {
  const db = getDb()

  const rows = await db
    .select()
    .from(teamInvitations)
    .where(eq(teamInvitations.teamId, teamId))
    .orderBy(teamInvitations.createdAt)

  return rows.map(toInvitation)
}

function canInvite(role: TeamRole): boolean {
  return role === 'owner' || role === 'admin'
}

function toInvitation(row: typeof teamInvitations.$inferSelect): TeamInvitation {
  return {
    id: row.id,
    teamId: row.teamId,
    email: row.email,
    role: row.role as TeamRole,
    invitedBy: row.invitedBy,
    token: row.token,
    expiresAt: row.expiresAt,
    acceptedAt: row.acceptedAt,
    createdAt: row.createdAt,
  }
}
