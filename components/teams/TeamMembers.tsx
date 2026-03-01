'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { TeamRole } from '@unblocks/core/teams/types'

interface Member {
  id: string
  userId: string
  email: string
  name: string | null
  role: TeamRole
  joinedAt: string
}

interface TeamMembersProps {
  teamId: string
  members: Member[]
  currentUserId: string
  currentUserRole: TeamRole
}

export function TeamMembers({
  teamId,
  members,
  currentUserId,
  currentUserRole,
}: TeamMembersProps) {
  const [memberList, setMemberList] = useState(members)
  const [loading, setLoading] = useState<string | null>(null)

  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin'

  async function handleRemove(userId: string) {
    if (!confirm('Remove this member from the team?')) return

    setLoading(userId)
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${userId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setMemberList((prev) => prev.filter((m) => m.userId !== userId))
      }
    } catch (err) {
      console.error('Remove failed:', err)
    } finally {
      setLoading(null)
    }
  }

  async function handleRoleChange(userId: string, newRole: TeamRole) {
    setLoading(userId)
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      if (res.ok) {
        setMemberList((prev) =>
          prev.map((m) =>
            m.userId === userId ? { ...m, role: newRole } : m
          )
        )
      }
    } catch (err) {
      console.error('Role update failed:', err)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="divide-y divide-border rounded-lg border border-border">
      {memberList.map((member) => (
        <div
          key={member.id}
          className="flex items-center justify-between px-4 py-3"
        >
          <div>
            <p className="text-sm font-medium text-foreground">
              {member.name ?? member.email}
            </p>
            {member.name ? (
              <p className="text-xs text-muted-foreground">{member.email}</p>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            {canManage && currentUserRole === 'owner' && member.userId !== currentUserId ? (
              <select
                value={member.role}
                onChange={(e) =>
                  handleRoleChange(member.userId, e.target.value as TeamRole)
                }
                disabled={loading === member.userId}
                className="rounded border border-border bg-background px-2 py-1 text-xs"
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
              </select>
            ) : (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize text-muted-foreground">
                {member.role}
              </span>
            )}

            {canManage &&
              member.userId !== currentUserId &&
              member.role !== 'owner' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(member.userId)}
                loading={loading === member.userId}
              >
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
