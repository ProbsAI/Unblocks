'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

export function ManageSubscription() {
  const [loading, setLoading] = useState(false)

  async function handleManage() {
    setLoading(true)

    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
      })

      const data = await response.json()

      if (data.data?.url) {
        window.location.href = data.data.url
      }
    } catch (error) {
      console.error('Portal error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" onClick={handleManage} loading={loading}>
      Manage Subscription
    </Button>
  )
}
