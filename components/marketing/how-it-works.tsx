'use client'

import { motion } from 'motion/react'
import { Archive, FileText, PenTool, Send, Workflow } from 'lucide-react'
import { SectionHeading } from './section-heading'

const STEPS = [
  {
    icon: FileText,
    title: 'Create the template',
    body: 'Build the document in the editor, or upload a PDF and drop signature and data fields exactly where they belong.',
  },
  {
    icon: Workflow,
    title: 'Define the workflow',
    body: 'Set the approval order and route each step to the right person, role or department.',
  },
  {
    icon: Send,
    title: 'Send it for approval',
    body: 'Approvers find the request waiting in their inbox. Nobody has to be tracked down in a corridor.',
  },
  {
    icon: PenTool,
    title: 'Collect signatures',
    body: 'Sign digitally, or record a physical signature against the same record. Status updates as each step completes.',
  },
  {
    icon: Archive,
    title: 'Archive and verify',
    body: 'Finished documents are stored under your retention policy, searchable, and verifiable from a public link.',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="How it works"
          title="From a blank form to a signed, filed record."
          description="Five steps, the same every time — which is exactly why the process stops depending on who happens to be in the office."
        />

        <div className="relative mt-16">
          {/* Progress rail — vertical on mobile, horizontal from lg up */}
          <div
            aria-hidden
            className="absolute left-[1.375rem] top-2 h-[calc(100%-1rem)] w-px bg-signara-steel/25 lg:hidden"
          >
            <motion.div
              className="h-full w-full origin-top bg-signara-gold"
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 1.6, ease: 'easeInOut' }}
            />
          </div>
          <div
            aria-hidden
            className="absolute left-[1.375rem] top-[1.375rem] hidden h-px w-[calc(80%+1.375rem)] bg-signara-steel/25 lg:block"
          >
            <motion.div
              className="h-full w-full origin-left bg-signara-gold"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 1.6, ease: 'easeInOut' }}
            />
          </div>

          <ol className="relative grid gap-10 lg:grid-cols-5 lg:gap-8">
            {STEPS.map((step, index) => (
              <motion.li
                key={step.title}
                className="flex gap-5 lg:flex-col lg:gap-0"
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ duration: 0.5, delay: 0.15 + index * 0.16 }}
              >
                <span className="relative z-10 inline-flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-signara-gold bg-white text-signara-navy shadow-sm">
                  <step.icon className="size-5" />
                </span>

                <div className="lg:mt-6 lg:pr-6">
                  <p className="font-mono text-xs font-semibold text-signara-gold">
                    {String(index + 1).padStart(2, '0')}
                  </p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-signara-navy">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-signara-navy/70">
                    {step.body}
                  </p>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
