'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    setSubmitted(true)
    setLoading(false)
  }

  return (
    <Card>
      <h1 className="text-center text-2xl font-bold text-foreground">
        Reset your password
      </h1>

      {submitted ? (
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            If an account exists for <strong>{email}</strong>, we&apos;ve sent a
            password reset link.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            Back to login
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Enter your email and we&apos;ll send a reset link
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            <Button type="submit" loading={loading} className="w-full">
              Send reset link
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline">
              Back to login
            </Link>
          </p>
        </>
      )}
    </Card>
  )
}
