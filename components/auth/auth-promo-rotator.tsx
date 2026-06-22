'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const PROMO_MESSAGES = [
  {
    headline: 'Replace paper with secure digital workflows',
    body: 'Signara turns approval chains into auditable, end-to-end digital processes — no printing, scanning, or chasing signatures.',
  },
  {
    headline: 'Route documents to the right people, automatically',
    body: 'Build multi-step signing workflows so every stakeholder reviews and approves in the correct order, every time.',
  },
  {
    headline: 'Every action recorded. Every approval traceable.',
    body: 'A complete audit trail gives your organisation confidence that documents are handled securely and compliantly.',
  },
  {
    headline: 'Cut approval turnaround from days to hours',
    body: 'Stop waiting on physical handoffs. Send, sign, and complete documents from anywhere your team works.',
  },
  {
    headline: 'Templates that scale across your organisation',
    body: 'Create reusable document templates and workflows so teams launch consistent, professional processes in minutes.',
  },
  {
    headline: 'Built for Zimbabwe and the SADC region',
    body: 'Signara is designed for how modern organisations in Southern Africa manage contracts, approvals, and compliance.',
  },
] as const

const ROTATE_MS = 6000
const FADE_MS = 500

export function AuthPromoRotator({ className }: { className?: string }) {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex((current) => (current + 1) % PROMO_MESSAGES.length)
        setVisible(true)
      }, FADE_MS)
    }, ROTATE_MS)

    return () => clearInterval(interval)
  }, [])

  const message = PROMO_MESSAGES[index]

  return (
    <div className={cn('min-h-[12rem]', className)}>
      <blockquote
        className={cn(
          'space-y-4 transition-opacity duration-500 ease-in-out',
          visible ? 'opacity-100' : 'opacity-0'
        )}
        aria-live="polite"
      >
        <p className="text-3xl font-bold leading-tight text-white">
          {message.headline}
        </p>
        <p className="text-lg leading-relaxed text-signara-steel">
          {message.body}
        </p>
      </blockquote>

      <div className="mt-8 flex gap-2">
        {PROMO_MESSAGES.map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-1 rounded-full transition-all duration-300',
              i === index
                ? 'w-6 bg-signara-gold'
                : 'w-1.5 bg-white/25'
            )}
            aria-hidden
          />
        ))}
      </div>
    </div>
  )
}
