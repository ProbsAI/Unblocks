'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { Plan } from '@unblocks/core/billing/types'

interface PricingTableProps {
  plans: Plan[]
  currentPlan: string
}

export function PricingTable({ plans, currentPlan }: PricingTableProps) {
  const [loading, setLoading] = useState<string | null>(null)

  async function handleUpgrade(planId: string) {
    setLoading(planId)

    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, interval: 'monthly' }),
      })

      const data = await response.json()

      if (data.data?.url) {
        window.location.href = data.data.url
      }
    } catch (error) {
      console.error('Checkout error:', error)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => {
        const isCurrent = plan.id === currentPlan
        const isFree = plan.price.monthly === 0

        return (
          <div
            key={plan.id}
            className={`rounded-lg border p-6 ${
              isCurrent ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <h3 className="text-lg font-semibold text-foreground">
              {plan.name}
            </h3>
            <div className="mt-2">
              <span className="text-3xl font-bold">${plan.price.monthly}</span>
              {!isFree ? (
                <span className="text-muted-foreground">/mo</span>
              ) : null}
            </div>
            <ul className="mt-4 space-y-2">
              {plan.features.map((feature) => (
                <li
                  key={feature}
                  className="text-sm text-muted-foreground"
                >
                  &#10003; {feature.replace(/_/g, ' ')}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              {isCurrent ? (
                <Button variant="outline" disabled className="w-full">
                  Current plan
                </Button>
              ) : isFree ? (
                <Button variant="outline" disabled className="w-full">
                  Free tier
                </Button>
              ) : (
                <Button
                  onClick={() => handleUpgrade(plan.id)}
                  loading={loading === plan.id}
                  className="w-full"
                >
                  Upgrade
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
