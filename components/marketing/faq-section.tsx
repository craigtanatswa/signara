import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Reveal } from './reveal'
import { SectionHeading } from './section-heading'

const FAQS = [
  {
    question: 'Do we have to give up physical signatures?',
    answer:
      'No. Where an original has to be signed by hand, Signara records that physical signature against the same document, so the wet-ink copy and its digital audit trail stay attached to one another.',
  },
  {
    question: 'How long does it take to get going?',
    answer:
      'Create your organisation, invite your team, build a template and route your first approval. There is no implementation project to schedule and no consultant to book.',
  },
  {
    question: 'Can someone outside our organisation confirm a document is genuine?',
    answer:
      'Yes. Every document has a public verification page that confirms its status and signature progress without exposing the contents or the signature images themselves.',
  },
  {
    question: 'What happens to documents once they are complete?',
    answer:
      'They move into your archive under the retention policy you set, where they stay searchable — rather than accumulating in cabinets, inboxes and shared drives.',
  },
  {
    question: 'Is Signara a replacement for our ERP?',
    answer:
      'No. It replaces the idea of extending an ERP to handle document approvals. If you already run one, Signara takes on the templates, routing and signing without adding a module or a customisation project.',
  },
  {
    question: 'Is it built for how organisations work in this region?',
    answer:
      'Signara is designed around how organisations in Zimbabwe and the wider SADC region manage contracts, approvals and compliance, including the reality that some documents still need a printed original.',
  },
]

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-24 bg-signara-background py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <SectionHeading
            eyebrow="Questions"
            title="The things people ask before they start."
          />
          <Reveal delay={0.1} className="mt-8">
            <p className="text-base leading-relaxed text-signara-navy/70">
              Still weighing it up? Start a free trial and route one real
              document through Signara — it answers most of this faster than we
              can.
            </p>
            <Link
              href="/register"
              className="group mt-5 inline-flex items-center gap-2 text-sm font-semibold text-signara-navy transition-colors hover:text-signara-gold"
            >
              Start your free trial
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Reveal>
        </div>

        <Reveal delay={0.08}>
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((faq) => (
              <AccordionItem
                key={faq.question}
                value={faq.question}
                className="border-signara-steel/30"
              >
                <AccordionTrigger className="py-5 text-base font-semibold text-signara-navy hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="pb-5 pr-8 text-sm leading-relaxed text-signara-navy/70">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  )
}
