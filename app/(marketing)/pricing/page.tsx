import { Navbar } from '@/components/landing/Navbar'
import { Pricing } from '@/components/landing/Pricing'
import { FAQ } from '@/components/landing/FAQ'
import { Footer } from '@/components/landing/Footer'
import { loadConfig } from '@unblocks/core/runtime/configLoader'

export const metadata = {
  title: 'Pricing',
  description: 'Simple, transparent pricing. Start free. Upgrade when you\'re ready.',
}

export default async function PricingPage() {
  const billingConfig = await loadConfig('billing')
  const appConfig = await loadConfig('app')

  return (
    <div className="min-h-screen bg-background">
      <Navbar appName={appConfig.name} />
      <div className="pt-16">
        <Pricing plans={billingConfig.plans} />
        {appConfig.landing.faq.length > 0 ? (
          <FAQ items={appConfig.landing.faq} />
        ) : null}
      </div>
      <Footer
        appName={appConfig.name}
        attribution={appConfig.footer.attribution}
      />
    </div>
  )
}
