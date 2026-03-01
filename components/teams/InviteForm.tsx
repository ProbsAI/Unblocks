'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface InviteFormProps {
  teamId: string
  onInvited?: () => void
}

export function InviteForm({ teamId, onInvited }: InviteFormProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error?.message ?? 'Failed to send invitation')
        return
      }

      setSuccess(`Invitation sent to ${email}`)
      setEmail('')
      onInvited?.()
    } catch {
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-3">
        <div className="flex-1">
          <Input
            type="email"
            placeholder="colleague@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <select
          value={role}
          onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>

        <Button type="submit" loading={loading}>
          Invite
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-error">{error}</p>
      ) : null}
      {success ? (
        <p className="text-sm text-success">{success}</p>
      ) : null}
    </form>
  )
}
