import type { TeamsConfig } from '@unblocks/core/teams/types'

const config: TeamsConfig = {
  enabled: true,
  maxMembersPerTeam: 50,
  maxTeamsPerUser: 5,
  roles: [
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
  ],
  invitationExpiryHours: 72,
  allowTeamCreation: true,
  requireEmailVerification: true,
}

export default config
