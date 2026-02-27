import { getCurrentUser } from '@/lib/serverAuth'
import { getTeam, getTeamMembers, getUserTeamRole } from '@unblocks/core/teams'
import { Card } from '@/components/ui/Card'
import { TeamMembers } from '@/components/teams/TeamMembers'
import { InviteForm } from '@/components/teams/InviteForm'
import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function TeamDetailPage({ params }: PageProps) {
  const { id } = await params
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const team = await getTeam(id)
  const members = await getTeamMembers(id)
  const currentRole = await getUserTeamRole(id, user.id)

  if (!currentRole) {
    redirect('/teams')
  }

  const canInvite = currentRole === 'owner' || currentRole === 'admin'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{team.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          /{team.slug}
        </p>
      </div>

      {canInvite ? (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Invite Members
          </h2>
          <InviteForm teamId={id} />
        </Card>
      ) : null}

      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Members ({members.length})
        </h2>
        <TeamMembers
          teamId={id}
          members={members.map((m) => ({
            ...m,
            joinedAt: m.joinedAt.toISOString(),
          }))}
          currentUserId={user.id}
          currentUserRole={currentRole}
        />
      </div>
    </div>
  )
}
