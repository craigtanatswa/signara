import Link from 'next/link'
import { isApproachingLimit, type PlanLimitCheck } from '@/lib/billing/limits'

export function PlanUsageBanner({ limits }: { limits: PlanLimitCheck }) {
  const messages: string[] = []

  if (isApproachingLimit(limits.documentsUsed, limits.documentsLimit)) {
    messages.push(
      `You're approaching your plan limit — ${limits.documentsUsed} of ${limits.documentsLimit} documents used this month.`
    )
  }

  if (isApproachingLimit(limits.usersUsed, limits.usersLimit)) {
    messages.push(
      `You're approaching your plan limit — ${limits.usersUsed} of ${limits.usersLimit} users.`
    )
  }

  if (messages.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p>{messages[0]}</p>
      {messages[1] && <p className="mt-1">{messages[1]}</p>}
      <Link
        href="/dashboard/settings/billing"
        className="mt-2 inline-block font-semibold text-signara-navy underline-offset-2 hover:underline"
      >
        View plans
      </Link>
    </div>
  )
}
