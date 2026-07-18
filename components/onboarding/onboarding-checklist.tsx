'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { Check, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { dismissOnboardingChecklist } from '@/app/actions/onboarding'
import { toast } from 'sonner'

export interface OnboardingItem {
  id: string
  label: string
  href: string
  complete: boolean
}

interface OnboardingChecklistProps {
  items: OnboardingItem[]
}

export function OnboardingChecklist({ items }: OnboardingChecklistProps) {
  const [pending, startTransition] = useTransition()
  const completed = items.filter((item) => item.complete).length
  const total = items.length
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100)

  function handleDismiss() {
    startTransition(async () => {
      const result = await dismissOnboardingChecklist()
      if (result.error) {
        toast.error('Could not dismiss checklist', { description: result.error })
      }
    })
  }

  return (
    <div className="rounded-lg border border-signara-steel/30 border-t-2 border-t-signara-gold bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-signara-navy">Get started with Signara</h3>
          <p className="mt-1 text-sm text-signara-steel">
            {completed} of {total} complete
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          disabled={pending}
          className="text-signara-steel"
        >
          Dismiss
        </Button>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-signara-steel/20">
        <div
          className="h-full rounded-full bg-signara-gold transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            {item.complete ? (
              <div className="flex items-center gap-2 text-sm text-signara-navy">
                <Check className="size-4 text-signara-gold" />
                <span className="line-through opacity-70">{item.label}</span>
              </div>
            ) : (
              <Link
                href={item.href}
                className="flex items-center gap-2 text-sm text-signara-navy hover:text-signara-gold"
              >
                <Circle className="size-4 text-signara-steel" />
                <span>{item.label}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
