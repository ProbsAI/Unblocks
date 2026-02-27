'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { AdminUser } from '@unblocks/core/admin/types'

interface UserTableProps {
  users: AdminUser[]
}

export function UserTable({ users: initialUsers }: UserTableProps) {
  const [users, setUsers] = useState(initialUsers)
  const [loading, setLoading] = useState<string | null>(null)

  async function handleStatusChange(userId: string, status: string) {
    setLoading(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, status } : u))
        )
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Plan</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Logins</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.map((user) => (
            <tr key={user.id}>
              <td className="px-4 py-3 text-foreground">
                {user.email}
                {user.emailVerified ? (
                  <span className="ml-1 text-xs text-success" title="Verified">&#10003;</span>
                ) : null}
              </td>
              <td className="px-4 py-3 text-foreground">
                {user.name ?? '-'}
              </td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                  {user.plan ?? 'free'}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  user.status === 'active'
                    ? 'bg-success/10 text-success'
                    : user.status === 'suspended'
                    ? 'bg-warning/10 text-warning'
                    : 'bg-error/10 text-error'
                }`}>
                  {user.status}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {user.loginCount}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(user.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                {user.status === 'active' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStatusChange(user.id, 'suspended')}
                    loading={loading === user.id}
                  >
                    Suspend
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStatusChange(user.id, 'active')}
                    loading={loading === user.id}
                  >
                    Activate
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
