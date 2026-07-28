import { createClient } from '@/lib/supabase/server'
import { MarketingHeader } from '@/components/marketing/marketing-header'
import { MarketingFooter } from '@/components/marketing/marketing-footer'
import { Hero } from '@/components/marketing/hero'
import { ValueMarquee } from '@/components/marketing/value-marquee'
import { AudienceSection } from '@/components/marketing/audience-section'
import { HowItWorks } from '@/components/marketing/how-it-works'
import { ProofBand } from '@/components/marketing/proof-band'
import { CostComparison } from '@/components/marketing/cost-comparison'
import { PricingSection } from '@/components/marketing/pricing-section'
import { FaqSection } from '@/components/marketing/faq-section'
import { FinalCta } from '@/components/marketing/final-cta'

/** A Supabase outage should degrade the CTA, never the landing page. */
async function getIsAuthenticated() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return Boolean(user)
  } catch {
    return false
  }
}

export default async function LandingPage() {
  const isAuthenticated = await getIsAuthenticated()

  return (
    <>
      <MarketingHeader isAuthenticated={isAuthenticated} />
      <main>
        <Hero isAuthenticated={isAuthenticated} />
        <ValueMarquee />
        <AudienceSection />
        <HowItWorks />
        <ProofBand />
        <CostComparison />
        <PricingSection />
        <FaqSection />
        <FinalCta isAuthenticated={isAuthenticated} />
      </main>
      <MarketingFooter />
    </>
  )
}
