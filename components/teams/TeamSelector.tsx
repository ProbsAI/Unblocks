'use client'

import { useState, useEffect } from 'react'
import type { Team, TeamRole } from '@unblocks/core/teams/types'

interface TeamSelectorProps {
  currentTeamId?: string
  onTeamChange: (teamId: string) => void
}

type TeamWithRole = Team & { role: TeamRole }

export function TeamSelector({ currentTeamId, onTeamChange }: TeamSelectorProps) {
  const [teams, setTeams] = useState<TeamWithRole[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTeams() {
      try {
        const res = await fetch('/api/teams')
        const data = await res.json()
        if (data.data) {
          setTeams(data.data)
        }
      } catch (err) {
        console.error('Failed to load teams:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchTeams()
  }, [])

  if (loading) {
    return (
      <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
    )
  }

  if (teams.length === 0) {
    return null
  }

  return (
    <select
      value={currentTeamId ?? ''}
      onChange={(e) => onTeamChange(e.target.value)}
      className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
    >
      <option value="">Personal</option>
      {teams.map((team) => (
        <option key={team.id} value={team.id}>
          {team.name}
        </option>
      ))}
    </select>
  )
}
