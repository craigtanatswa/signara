import Link from 'next/link'
import { ArrowRight, Check, Coins, FolderSearch, PenLine } from 'lucide-react'
import { Reveal } from './reveal'
import { SectionHeading } from './section-heading'

const AUDIENCES = [
  {
    icon: FolderSearch,
    who: 'Operations & administration',
    pain: 'The filing never ends.',
    reality:
      'The same forms get rebuilt every week. Signed copies live in a cabinet, a shared drive and somebody’s inbox at the same time. When an auditor asks for last March’s approval, the search takes days.',
    solutions: [
      'Build each form once as a reusable template — every team launches the same approved version.',
      'Completed documents land in a searchable archive governed by your retention policy.',
      'A full audit trail answers “who approved this, and when” in one click.',
    ],
  },
  {
    icon: PenLine,
    who: 'Executives & approvers',
    pain: 'The signature queue owns your day.',
    reality:
      'Documents stack up waiting on one signature. People chase you in the corridor, on WhatsApp, by email. Printing and scanning turns a thirty-second decision into a half-day errand.',
    solutions: [
      'Everything waiting on you sits in one requests inbox, in the order it needs attention.',
      'Sign digitally from any device — or record a physical signature when wet ink is required.',
      'The moment you approve, the document routes itself to the next person in the workflow.',
    ],
  },
  {
    icon: Coins,
    who: 'Organisations weighing an ERP',
    pain: 'You need approvals, not a two-year project.',
    reality:
      'Getting document approvals out of an ERP means licences, consultants, customisation and months of implementation — for a problem that is really about routing, signing and storing documents.',
    solutions: [
      'Purpose-built for document work: templates, routing, signing, archive and verification.',
      'Your own team can be live in days, without an implementation partner.',
      'Transparent monthly pricing from $50 — no consulting retainer to get started.',
    ],
  },
]

export function AudienceSection() {
  return (
    <section id="who-its-for" className="scroll-mt-24 bg-signara-background py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Who it's for"
          title="Three familiar bottlenecks. One place to fix them."
          description="Signara was built around the three ways organisations lose time to documents — and each one has a direct answer in the product."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {AUDIENCES.map((audience, index) => (
            <Reveal key={audience.who} delay={index * 0.1} className="flex">
              <article className="flex flex-col rounded-xl border border-signara-steel/30 border-t-2 border-t-signara-gold bg-white p-7 shadow-sm">
                <span className="inline-flex size-11 items-center justify-center rounded-lg bg-signara-navy/5 text-signara-navy">
                  <audience.icon className="size-5" />
                </span>

                <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-signara-navy/70">
                  {audience.who}
                </p>
                <h3 className="mt-2 font-display text-2xl font-semibold leading-snug text-signara-navy">
                  {audience.pain}
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-signara-navy/70">
                  {audience.reality}
                </p>

                <p className="mt-7 text-xs font-semibold uppercase tracking-[0.18em] text-signara-navy">
                  With Signara
                </p>
                <ul className="mt-4 space-y-3">
                  {audience.solutions.map((solution) => (
                    <li key={solution} className="flex gap-3">
                      <Check className="mt-0.5 size-4 shrink-0 text-signara-gold" />
                      <span className="text-sm leading-relaxed text-signara-navy/80">
                        {solution}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className="group mt-auto inline-flex items-center gap-2 pt-8 text-sm font-semibold text-signara-navy transition-colors hover:text-signara-gold"
                >
                  Try it free
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
