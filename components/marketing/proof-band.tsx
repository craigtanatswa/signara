import { Repeat2, Search, ShieldCheck, Zap } from 'lucide-react'
import { Reveal } from './reveal'

const PROOF = [
  {
    icon: Search,
    text: 'Find a signed document in seconds instead of digging through cabinets or shared drives.',
  },
  {
    icon: ShieldCheck,
    text: 'Sensitive approvals stay permissioned, controlled and traceable from start to finish.',
  },
  {
    icon: Zap,
    text: 'Executives clear their signature queue without printing, scanning or chasing anyone.',
  },
  {
    icon: Repeat2,
    text: 'Ops teams stop rebuilding the same form every week — templates keep it consistent.',
  },
]

export function ProofBand() {
  return (
    <section className="bg-signara-navy py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="max-w-2xl">
          <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
            The difference shows up in ordinary weeks.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-white/70">
            Not in a launch announcement — in the small, repeated moments where
            documents used to stall.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-x-10 gap-y-9 sm:grid-cols-2">
          {PROOF.map((item, index) => (
            <Reveal
              key={item.text}
              delay={index * 0.08}
              className="flex gap-4 border-l-2 border-signara-gold/70 pl-5"
            >
              <item.icon className="mt-0.5 size-5 shrink-0 text-signara-gold" />
              <p className="text-base leading-relaxed text-white/85">
                {item.text}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
