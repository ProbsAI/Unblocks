import { listUsers } from '@unblocks/core/admin'
import { UserTable } from '@/components/admin/UserTable'

export const metadata = { title: 'Admin - Users' }

export default async function AdminUsersPage() {
  const result = await listUsers({ limit: 100 })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Users</h1>
        <p className="text-sm text-muted-foreground">
          {result.total} total users
        </p>
      </div>
      <UserTable users={result.users} />
    </div>
  )
}
