'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function ResetPasswordConfirmPage() {
  return (
    <Suspense fallback={<Card><p className="text-center text-muted-foreground">Loading…</p></Card>}>
      <ResetPasswordConfirmForm />
    </Suspense>
  )
}

function ResetPasswordConfirmForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error?.message ?? 'Reset failed')
        return
      }

      setSuccess(true)
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Card>
        <h1 className="text-center text-2xl font-bold text-foreground">
          Password reset!
        </h1>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Your password has been reset. You can now log in with your new password.
        </p>
        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-sm text-primary hover:underline"
          >
            Go to login
          </Link>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <h1 className="text-center text-2xl font-bold text-foreground">
        Choose a new password
      </h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {error ? (
          <div className="rounded-md bg-red-50 p-3 text-sm text-error">
            {error}
          </div>
        ) : null}
        <Input
          label="New password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min. 8 characters"
          required
          minLength={8}
        />
        <Button type="submit" loading={loading} className="w-full">
          Reset password
        </Button>
      </form>
    </Card>
  )
}
