import { eq, and, gt, isNull, sql } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { getDb } from '../db/client'
import { teamMembers, teamInvitations } from '../db/schema/teams'
import { users } from '../db/schema/users'
import { loadConfig } from '../runtime/configLoader'
import { runHook } from '../runtime/hookRunner'
import { ConflictError, ForbiddenError, NotFoundError } from '../errors/types'
import { encrypt } from '../security/encryption'
import { blindIndex } from '../security/blindIndex'
import { isWellFormedToken } from '../auth/token'
import { getUserTeamRole } from './getTeam'
import type {
  TeamInvitation,
  CreatedTeamInvitation,
  TeamRole,
  OnTeamMemberAddedArgs,
} from './types'

/**
 * Invite a user to a team by email.
 */
export async function inviteMember(
  teamId: string,
  email: string,
  role: TeamRole,
  invitedBy: string
): Promise<CreatedTeamInvitation> {
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

  const emailLower = email.toLowerCase()
  const [invitation] = await db
    .insert(teamInvitations)
    .values({
      teamId,
      email: emailLower,
      emailEncrypted: encrypt(emailLower),
      role,
      invitedBy,
      token: blindIndex(token),
      tokenHash: blindIndex(token),
      expiresAt,
    })
    .returning()

  // The plaintext token exists only here. The DB holds a blind index, so this
  // is the sole opportunity to build an invite link.
  return { ...toInvitation(invitation), token }
}

/**
 * Accept a team invitation by token.
 */
export async function acceptInvitation(
  token: string,
  userId: string
): Promise<void> {
  // Bound the input before deriving a blind index: this is reached from a
  // public endpoint and blindIndex runs PBKDF2. See isWellFormedToken.
  if (!isWellFormedToken(token)) {
    throw new NotFoundError('Invitation not found')
  }

  const db = getDb()

  // Check the accepting user BEFORE claiming the token.
  //
  // teams.requireEmailVerification defaults to true and was enforced nowhere —
  // requireAuth() establishes identity, not that the address was ever proven.
  // The order matters as much as the check: claiming first would consume a
  // one-time invitation on behalf of someone who is then refused, leaving the
  // real invitee with a dead link.
  if (loadConfig('teams').requireEmailVerification) {
    const [accepting] = await db
      .select({ emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!accepting?.emailVerified) {
      throw new ForbiddenError(
        'Verify your email address before joining a team'
      )
    }
  }

  // Matched on the digest only.
  //
  // There used to be a fallback to the plaintext `token` column for rows
  // written before tokenHash existed. Honouring it meant those invitations
  // stayed redeemable straight out of a database dump — the exact thing the
  // one-way storage invariant exists to prevent — so the fallback is gone.
  // Any such row is now unredeemable and should be re-sent.
  const matchesToken = eq(teamInvitations.tokenHash, blindIndex(token))

  // Claim before doing anything, in one statement.
  //
  // Reading the row, checking acceptedAt, adding the member and only then
  // marking it accepted let two different people redeem the same invitation:
  // both read a null acceptedAt, both pass, and both join the team. The
  // per-user "already a member" check below does not help, because they are
  // different users. An invitation is for one person, so the flag has to be
  // the thing that decides — which means it has to be set under the row lock.
  //
  // As with verification tokens, winning the claim consumes the invitation even
  // if adding the member then fails. That is the right trade for a one-time
  // credential; the alternative is an invitation that can be redeemed twice.
  const [invitation] = await db
    .update(teamInvitations)
    .set({ acceptedAt: new Date() })
    .where(
      and(
        matchesToken,
        isNull(teamInvitations.acceptedAt),
        gt(teamInvitations.expiresAt, new Date())
      )
    )
    .returning()

  if (!invitation) {
    // Losing the claim is ambiguous, so read back to say why. Only on the
    // failure path, and it cannot grant anything.
    const [existing] = await db
      .select()
      .from(teamInvitations)
      .where(matchesToken)
      .limit(1)

    if (!existing) throw new NotFoundError('Invitation not found')
    if (existing.acceptedAt) {
      throw new ConflictError('Invitation has already been accepted')
    }
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
    expiresAt: row.expiresAt,
    acceptedAt: row.acceptedAt,
    createdAt: row.createdAt,
  }
}
