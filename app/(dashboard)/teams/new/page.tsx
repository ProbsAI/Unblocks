'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

export default function NewTeamPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleNameChange(value: string) {
    setName(value)
    setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error?.message ?? 'Failed to create team')
        return
      }

      router.push(`/teams/${data.data.id}`)
    } catch {
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Create Team</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a new team to collaborate with others
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Team Name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="My Team"
            required
          />

          <Input
            label="Team Slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="my-team"
            required
          />
          <p className="text-xs text-muted-foreground">
            URL-friendly identifier. Only lowercase letters, numbers, and hyphens.
          </p>

          {error ? (
            <p className="text-sm text-error">{error}</p>
          ) : null}

          <Button type="submit" loading={loading} className="w-full">
            Create Team
          </Button>
        </form>
      </Card>
    </div>
  )
}
