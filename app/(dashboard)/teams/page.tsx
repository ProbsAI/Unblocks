import { getCurrentUser } from '@/lib/serverAuth'
import { getUserTeams } from '@unblocks/core/teams'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'

export const metadata = { title: 'Teams' }

export default async function TeamsPage() {
  const user = await getCurrentUser()
  const teams = user ? await getUserTeams(user.id) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Teams</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your teams and collaborators
          </p>
        </div>
        <Link
          href="/teams/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          Create Team
        </Link>
      </div>

      {teams.length === 0 ? (
        <Card>
          <div className="py-8 text-center">
            <p className="text-muted-foreground">
              You don&apos;t belong to any teams yet.
            </p>
            <Link
              href="/teams/new"
              className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
            >
              Create your first team
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Link key={team.id} href={`/teams/${team.id}`}>
              <Card>
                <h3 className="text-lg font-semibold text-foreground">
                  {team.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  /{team.slug}
                </p>
                <div className="mt-3">
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize text-muted-foreground">
                    {team.role}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
