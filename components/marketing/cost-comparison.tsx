'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { CalendarClock, Check, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from './reveal'
import { SectionHeading } from './section-heading'
import { cn } from '@/lib/utils'

const ERP_PATH = [
  'Small business suites: roughly $3,000 – $25,000 in the first year, software plus implementation.',
  'Mid-market implementations: commonly $20,000 – $125,000+ in the first year.',
  'Midsize rollouts across Africa are frequently quoted from tens of thousands up to $150,000+, depending on scope.',
  'Annual maintenance and support typically runs 15 – 25% of licence or subscription value.',
  'Scope you pay for: finance, inventory, HR and manufacturing modules you may never switch on.',
]

const SIGNARA_PATH = [
  '$50 – $100 per month for the organisation, billed in USD.',
  'Starter $50 · Growth $75 · Enterprise $100 — published, not negotiated.',
  'No licence renewals, no implementation partner, no consulting retainer.',
  'Scope you pay for: templates, approval routing, digital and physical signing, archive and verification.',
  'Your own administrator sets it up — there is no configuration project to schedule.',
]

const SPEND_BARS = [
  {
    label: 'Mid-market ERP, first year',
    figure: '$20,000 – $125,000+',
    value: 125000,
    accent: false,
  },
  {
    label: 'Small business ERP, first year',
    figure: '$3,000 – $25,000',
    value: 25000,
    accent: false,
  },
  {
    label: 'Signara Enterprise, twelve months',
    figure: '$1,200',
    value: 1200,
    accent: true,
  },
  {
    label: 'Signara Starter, twelve months',
    figure: '$600',
    value: 600,
    accent: true,
  },
]

const MAX_SPEND = 125000

export function CostComparison() {
  return (
    <section id="cost" className="scroll-mt-24 bg-signara-background py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Cost comparison"
          title="An ERP programme, or a signed document this afternoon."
          description="If finance, inventory and HR genuinely need re-platforming, an ERP is the right tool. If what is actually stuck is getting documents approved and signed, the arithmetic looks very different."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <Reveal from="left" className="flex">
            <article className="flex w-full flex-col rounded-xl border border-signara-steel/40 bg-white/60 p-7">
              <h3 className="font-display text-xl font-semibold text-signara-navy">
                The ERP path
              </h3>
              <ul className="mt-6 flex-1 space-y-4">
                {ERP_PATH.map((item) => (
                  <li key={item} className="flex gap-3">
                    <Minus className="mt-1 size-4 shrink-0 text-signara-steel" />
                    <span className="text-sm leading-relaxed text-signara-navy/70">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex items-center gap-3 rounded-lg bg-signara-navy/5 px-4 py-3.5">
                <CalendarClock className="size-4 shrink-0 text-signara-steel" />
                <p className="text-sm font-medium text-signara-navy/80">
                  Time to value: months of scoping, configuration and consulting.
                </p>
              </div>
            </article>
          </Reveal>

          <Reveal from="right" delay={0.08} className="flex">
            <article className="flex w-full flex-col rounded-xl border border-signara-steel/30 border-t-2 border-t-signara-gold bg-white p-7 shadow-sm">
              <h3 className="font-display text-xl font-semibold text-signara-navy">
                The Signara path
              </h3>
              <ul className="mt-6 flex-1 space-y-4">
                {SIGNARA_PATH.map((item) => (
                  <li key={item} className="flex gap-3">
                    <Check className="mt-0.5 size-4 shrink-0 text-signara-gold" />
                    <span className="text-sm leading-relaxed text-signara-navy/80">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex items-center gap-3 rounded-lg bg-signara-gold/10 px-4 py-3.5">
                <CalendarClock className="size-4 shrink-0 text-signara-navy" />
                <p className="text-sm font-medium text-signara-navy">
                  Time to value: your first workflow can be live the day you sign up.
                </p>
              </div>
            </article>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <figure className="mt-8 rounded-xl border border-signara-steel/30 bg-white p-7 shadow-sm">
            <figcaption className="text-sm font-semibold text-signara-navy">
              First-year spend, drawn to one scale
            </figcaption>

            <div className="mt-7 space-y-6">
              {SPEND_BARS.map((bar, index) => {
                const width = Math.max((bar.value / MAX_SPEND) * 100, 2)

                return (
                  <div key={bar.label}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span
                        className={cn(
                          'text-sm',
                          bar.accent
                            ? 'font-semibold text-signara-navy'
                            : 'text-signara-navy/70'
                        )}
                      >
                        {bar.label}
                      </span>
                      <span
                        className={cn(
                          'font-mono text-sm',
                          bar.accent ? 'text-signara-navy' : 'text-signara-navy/70'
                        )}
                      >
                        {bar.figure}
                      </span>
                    </div>

                    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-signara-navy/5">
                      <motion.div
                        className={cn(
                          'h-full origin-left rounded-full',
                          bar.accent ? 'bg-signara-gold' : 'bg-signara-steel/70'
                        )}
                        style={{ width: `${width}%` }}
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.9, delay: index * 0.12 }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="mt-7 text-xs leading-relaxed text-signara-navy/70">
              Bars show the upper bound of each range on the same linear scale.
              ERP figures are widely published market estimates for full suites
              including implementation, and vary considerably by vendor, module
              count and partner. Signara figures are list price multiplied by
              twelve months.
            </p>
          </figure>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="mt-10 flex flex-col items-start gap-6 rounded-xl bg-signara-navy px-7 py-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-base leading-relaxed text-white/85">
              A year of Signara costs roughly what an ERP programme spends on a
              few days of consulting — and it only has to solve one problem
              well.
            </p>
            <Button asChild variant="signara" size="lg" className="h-11 shrink-0 px-6">
              <Link href="/register">Start free instead</Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
