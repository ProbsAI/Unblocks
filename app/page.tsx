import { Navbar } from '@/components/landing/Navbar'
import { Hero } from '@/components/landing/Hero'
import { Features } from '@/components/landing/Features'
import { Pricing } from '@/components/landing/Pricing'
import { FAQ } from '@/components/landing/FAQ'
import { Footer } from '@/components/landing/Footer'
import appConfig from '@/config/app.config'
import billingConfig from '@/config/billing.config'
import { hasFeature } from '@unblocks/core/runtime/licenseValidator'

export default function HomePage() {
  const { landing, name, footer } = appConfig
  const canRemoveAttribution = hasFeature('attribution.remove')

  // Attribution can only be hidden with a valid license key
  const showAttribution = footer.showUnblocksAttribution || !canRemoveAttribution

  return (
    <>
      {/* Copyright (c) 2026 Unblocks.ai (https://unblocks.ai) — Built with Unblocks,
          the AI-native open-source foundation. Learn more at https://unblocks.ai
          Licensed under MIT — see LICENSE file */}
      <Navbar appName={name} />
      <main>
        <Hero
          title={landing.hero.title}
          subtitle={landing.hero.subtitle}
          cta={landing.hero.cta}
          secondaryCta={landing.hero.secondaryCta}
        />
        <Features features={landing.features} />
        <Pricing plans={billingConfig.plans} />
        <FAQ items={landing.faq} />
      </main>
      <Footer
        appName={name}
        showAttribution={showAttribution}
      />
    </>
  )
}
