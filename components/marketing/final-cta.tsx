import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from './reveal'

export function FinalCta({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section className="relative overflow-hidden bg-signara-navy py-24 sm:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_120%_at_78%_10%,rgba(212,175,55,0.22),transparent_60%)]"
      />

      <Reveal className="relative mx-auto max-w-3xl px-5 text-center sm:px-8">
        <div className="flex items-center justify-center gap-3">
          <span aria-hidden className="h-px w-8 bg-signara-gold" />
          <span className="font-display text-xs font-semibold uppercase tracking-[0.32em] text-signara-gold">
            Signara
          </span>
          <span aria-hidden className="h-px w-8 bg-signara-gold" />
        </div>

        <h2 className="mt-6 font-display text-3xl font-semibold leading-tight tracking-tight text-white sm:text-[2.75rem]">
          Start your free trial — and watch the pile disappear.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/75">
          Set up your organisation, build your first template and route a real
          approval today. No credit card, no implementation project, no waiting
          on anyone else&rsquo;s calendar.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {isAuthenticated ? (
            <Button asChild variant="signara" size="lg" className="h-12 px-8 text-base">
              <Link href="/dashboard">
                Go to your dashboard
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="signara" size="lg" className="h-12 px-8 text-base">
                <Link href="/register">
                  Start your free trial
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 border-2 border-white/50 bg-transparent px-8 text-base font-semibold text-white shadow-none hover:bg-white hover:text-signara-navy dark:border-white/50 dark:bg-transparent dark:hover:bg-white"
              >
                <Link href="/login">Log in</Link>
              </Button>
            </>
          )}
        </div>
      </Reveal>
    </section>
  )
}
