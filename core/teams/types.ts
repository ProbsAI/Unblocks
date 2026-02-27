import { z } from 'zod'

export const TeamsConfigSchema = z.object({
  /** Enable teams/organizations */
  enabled: z.boolean().default(false),

  /** Max team members per team (0 = unlimited) */
  maxMembersPerTeam: z.number().default(0),

  /** Max teams a user can create (0 = unlimited) */
  maxTeamsPerUser: z.number().default(5),

  /** Available roles */
  roles: z.array(z.object({
    id: z.string(),
    name: z.string(),
    permissions: z.array(z.string()),
  })).default([
    {
      id: 'owner',
      name: 'Owner',
      permissions: ['*'],
    },
    {
      id: 'admin',
      name: 'Admin',
      permissions: [
        'team.read', 'team.update',
        'members.read', 'members.invite', 'members.remove', 'members.updateRole',
        'billing.read', 'billing.update',
        'resources.*',
      ],
    },
    {
      id: 'member',
      name: 'Member',
      permissions: [
        'team.read',
        'members.read',
        'resources.read', 'resources.create', 'resources.update',
      ],
    },
  ]),

  /** Invitation expiry in hours */
  invitationExpiryHours: z.number().default(72),

  /** Allow users to create teams */
  allowTeamCreation: z.boolean().default(true),

  /** Require email verification to join a team */
  requireEmailVerification: z.boolean().default(true),
})

export type TeamsConfig = z.infer<typeof TeamsConfigSchema>

export type TeamRole = 'owner' | 'admin' | 'member'

export interface Team {
  id: string
  name: string
  slug: string
  ownerId: string
  avatarUrl: string | null
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface TeamMember {
  id: string
  teamId: string
  userId: string
  role: TeamRole
  joinedAt: Date
}

export interface TeamInvitation {
  id: string
  teamId: string
  email: string
  role: TeamRole
  invitedBy: string
  token: string
  expiresAt: Date
  acceptedAt: Date | null
  createdAt: Date
}

export interface OnTeamCreatedArgs {
  team: Team
  owner: { id: string; email: string }
}

export interface OnTeamMemberAddedArgs {
  teamId: string
  userId: string
  role: TeamRole
  invitedBy: string | null
}

export interface OnTeamMemberRemovedArgs {
  teamId: string
  userId: string
  removedBy: string
}
