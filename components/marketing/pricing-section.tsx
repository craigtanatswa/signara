import Link from 'next/link'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from './reveal'
import { SectionHeading } from './section-heading'
import { cn } from '@/lib/utils'

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 50,
    summary: 'For a first team putting its core documents online.',
    features: [
      'Users up to your plan limit',
      'Monthly document allowance',
      'Digital and physical signing',
      'Email support',
    ],
    accent: false,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 75,
    summary: 'For organisations routing approvals across departments.',
    features: [
      'Higher user and document limits',
      'Approval workflows and routing',
      'Organisation branding',
      'Priority email support',
    ],
    accent: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 100,
    summary: 'For organisations standardising on Signara end to end.',
    features: [
      'Unlimited users and documents',
      'Advanced workflows',
      'Custom branding',
      'Dedicated support',
    ],
    accent: false,
  },
]

export function PricingSection() {
  return (
    <section id="pricing" className="scroll-mt-24 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Pricing"
          title="One monthly price for the whole organisation."
          description="No per-signature charges, no implementation fee. Start on a free trial and move to a paid plan when the workflows are yours."
          align="center"
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan, index) => (
            <Reveal key={plan.id} delay={index * 0.09} className="flex">
              <article
                className={cn(
                  'flex w-full flex-col rounded-xl border bg-white p-7',
                  plan.accent
                    ? 'border-signara-steel/30 border-t-2 border-t-signara-gold shadow-md'
                    : 'border-signara-steel/30 shadow-sm'
                )}
              >
                <h3 className="font-display text-xl font-semibold text-signara-navy">
                  {plan.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-signara-navy/65">
                  {plan.summary}
                </p>

                <p className="mt-7 flex items-baseline gap-1.5">
                  <span className="font-display text-4xl font-semibold text-signara-navy">
                    ${plan.price}
                  </span>
                  <span className="text-sm text-signara-navy/70">USD / month</span>
                </p>

                <ul className="mt-7 space-y-3 border-t border-signara-steel/25 pt-7">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3">
                      <Check className="mt-0.5 size-4 shrink-0 text-signara-gold" />
                      <span className="text-sm leading-relaxed text-signara-navy/80">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className="mt-auto pt-8 text-sm font-semibold text-signara-navy transition-colors hover:text-signara-gold"
                >
                  Start with {plan.name} →
                </Link>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.12} className="mt-12 flex flex-col items-center text-center">
          <Button asChild variant="signara" size="lg" className="h-12 px-8 text-base">
            <Link href="/register">Start your free trial</Link>
          </Button>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-signara-navy/70">
            No credit card required. Exact user and document limits for each plan
            are shown in billing once your organisation is set up.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
