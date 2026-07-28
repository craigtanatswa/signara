import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HeroVisual } from './hero-visual'

export function Hero({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(115%_85%_at_84%_16%,rgba(212,175,55,0.16),transparent_56%),radial-gradient(85%_75%_at_6%_-5%,rgba(15,44,89,0.10),transparent_62%)]"
      />

      <div className="mx-auto grid max-w-7xl items-center gap-y-4 px-5 pb-16 pt-10 sm:px-8 lg:min-h-[calc(100dvh-4.5rem)] lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-x-12 lg:pb-24 lg:pt-4">
        <div className="max-w-xl">
          <div className="flex items-center gap-3">
            <span aria-hidden className="h-px w-10 bg-signara-gold" />
            <span className="font-display text-xs font-semibold uppercase tracking-[0.32em] text-signara-navy/70">
              Signara
            </span>
          </div>

          <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.06] tracking-tight text-signara-navy sm:text-5xl xl:text-[3.75rem]">
            Replace the paper chase with{' '}
            <span className="relative whitespace-nowrap">
              approvals
              <span
                aria-hidden
                className="absolute inset-x-0 -bottom-1 h-[3px] rounded-full bg-signara-gold"
              />
            </span>{' '}
            you can trust.
          </h1>

          <p className="mt-7 max-w-lg text-lg leading-relaxed text-signara-navy/75">
            Signara turns the forms, sign-offs and signatures your organisation
            already depends on into secure digital workflows — routed to the
            right people, completed in minutes, and archived with a full audit
            trail.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            {isAuthenticated ? (
              <Button asChild variant="signara" size="lg" className="h-12 px-7 text-base">
                <Link href="/dashboard">
                  Go to your dashboard
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild variant="signara" size="lg" className="h-12 px-7 text-base">
                <Link href="/register">
                  Start your free trial
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            )}

            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 border-2 border-signara-navy bg-transparent px-7 text-base font-semibold text-signara-navy shadow-none hover:bg-signara-navy hover:text-white dark:border-signara-navy dark:bg-transparent dark:hover:bg-signara-navy"
            >
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>

          <p className="mt-5 text-sm text-signara-navy/70">
            No credit card required · Plans from $50 per month · Live the same
            day
          </p>
        </div>

        <div className="relative -mx-5 h-[340px] sm:-mx-8 sm:h-[420px] lg:mx-0 lg:h-[min(76dvh,640px)]">
          <HeroVisual />
        </div>
      </div>
    </section>
  )
}
