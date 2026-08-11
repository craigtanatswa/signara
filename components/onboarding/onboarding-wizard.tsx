'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Check, Circle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { completeOnboardingWizard } from '@/app/actions/onboarding'
import { Button } from '@/components/ui/button'
import type { OnboardingProgressItem } from '@/lib/onboarding/items'

export function OnboardingWizard({ items }: { items: OnboardingProgressItem[] }) {
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(() => {
    const firstIncomplete = items.findIndex((item) => !item.complete)
    return firstIncomplete === -1 ? items.length - 1 : firstIncomplete
  })
  const [pending, startTransition] = useTransition()

  const step = items[stepIndex]
  const completedCount = items.filter((i) => i.complete).length
  const allComplete = completedCount === items.length

  function goNext() {
    if (stepIndex < items.length - 1) {
      setStepIndex((i) => i + 1)
      return
    }
    if (!allComplete) {
      toast.error('Complete every step before finishing setup.')
      return
    }
    startTransition(async () => {
      const result = await completeOnboardingWizard()
      if (result.error) {
        toast.error(result.error)
        return
      }
      router.push('/dashboard')
      router.refresh()
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10">
      <div className="space-y-2 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-signara-gold">
          Setup wizard
        </p>
        <h1 className="text-3xl font-bold text-signara-navy">Get started with Signara</h1>
        <p className="text-signara-steel">
          Complete these steps to finish setting up your organisation ({completedCount} of{' '}
          {items.length} done).
        </p>
      </div>

      <ol className="flex flex-wrap justify-center gap-2">
        {items.map((item, index) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setStepIndex(index)}
              className={`flex size-9 items-center justify-center rounded-full text-sm font-semibold transition ${
                item.complete
                  ? 'bg-signara-gold text-signara-navy'
                  : index === stepIndex
                    ? 'bg-signara-navy text-white ring-2 ring-signara-gold'
                    : 'bg-signara-steel/30 text-signara-steel'
              }`}
              aria-label={`Step ${index + 1}: ${item.label}`}
            >
              {item.complete ? <Check className="size-4" /> : index + 1}
            </button>
          </li>
        ))}
      </ol>

      {step && (
        <div className="rounded-lg border border-signara-steel/30 border-t-2 border-t-signara-gold bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            {step.complete ? (
              <Check className="mt-0.5 size-5 text-signara-gold" />
            ) : (
              <Circle className="mt-0.5 size-5 text-signara-steel" />
            )}
            <div className="space-y-3">
              <div>
                <h2 className="text-xl font-semibold text-signara-navy">{step.label}</h2>
                <p className="mt-1 text-sm text-signara-steel">{step.description}</p>
              </div>
              {step.complete ? (
                <p className="text-sm font-medium text-green-700">Completed</p>
              ) : (
                <Button asChild variant="signara">
                  <Link href={step.href}>Go to {step.label.toLowerCase()}</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          className="border-signara-navy text-signara-navy"
          disabled={stepIndex === 0 || pending}
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
        >
          Back
        </Button>
        <Button type="button" variant="signara" disabled={pending} onClick={goNext}>
          {pending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Saving…
            </>
          ) : stepIndex === items.length - 1 ? (
            allComplete ? (
              'Finish setup'
            ) : (
              'Complete all steps to finish'
            )
          ) : (
            'Continue'
          )}
        </Button>
      </div>
    </div>
  )
}
