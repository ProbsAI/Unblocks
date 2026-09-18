import Link from 'next/link'
import type { Plan } from '@unblocks/core/billing/types'

interface PricingProps {
  plans: Plan[]
}

const ENTERPRISE_FEATURES = [
  'Everything in Business',
  'SSO / SAML / SCIM',
  'Multi-tenancy',
  'Compliance automation',
  'Dedicated support + SLA',
  'Custom integrations',
]

export function Pricing({ plans }: PricingProps) {
  return (
    <section className="px-4 py-24">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-center text-3xl font-bold text-foreground">
          Simple, transparent pricing
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          Start free with all core features. Upgrade when you need premium blocks and scale.
        </p>
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const isPopular = plan.id === 'pro'
            return (
              <div
                key={plan.id}
                className={`relative rounded-lg border p-8 ${
                  isPopular
                    ? 'border-primary shadow-lg'
                    : 'border-border'
                }`}
              >
                {isPopular ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-white">
                    Most Popular
                  </div>
                ) : null}
                <h3 className="text-lg font-semibold text-foreground">
                  {plan.name}
                </h3>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">
                    ${plan.price.monthly}
                  </span>
                  {plan.price.monthly > 0 ? (
                    <span className="text-muted-foreground">/mo</span>
                  ) : null}
                </div>
                <ul className="mt-8 space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <span className="mt-0.5 text-success">&#10003;</span>
                      {feature.replace(/_/g, ' ')}
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <Link
                    href="/signup"
                    className={`block w-full rounded-md py-2.5 text-center text-sm font-medium ${
                      isPopular
                        ? 'bg-primary text-white hover:bg-primary-hover'
                        : 'border border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    {plan.price.monthly === 0 ? 'Get Started Free' : 'Start Free Trial'}
                  </Link>
                </div>
              </div>
            )
          })}

          {/* Enterprise — Contact Sales */}
          <div className="relative rounded-lg border border-border bg-gradient-to-b from-white to-muted/30 p-8">
            <h3 className="text-lg font-semibold text-foreground">Enterprise</h3>
            <div className="mt-4">
              <span className="text-4xl font-bold text-foreground">Custom</span>
            </div>
            <ul className="mt-8 space-y-3">
              {ENTERPRISE_FEATURES.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <span className="mt-0.5 text-success">&#10003;</span>
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link
                href="/contact"
                className="block w-full rounded-md border border-border py-2.5 text-center text-sm font-medium text-foreground hover:bg-muted"
              >
                Contact Sales
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
