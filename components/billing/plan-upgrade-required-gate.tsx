'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AlertCircle, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getPlanUpgradeLockDescription,
  getPlanUpgradeLockTitle,
  isPlanUpgradeBypassPath,
  type PlanUpgradeLockState,
} from '@/lib/billing/plan-upgrade-lock'

interface PlanUpgradeRequiredGateProps {
  lock: PlanUpgradeLockState | null
  isAdmin: boolean
  children: React.ReactNode
}

export function PlanUpgradeRequiredGate({
  lock,
  isAdmin,
  children,
}: PlanUpgradeRequiredGateProps) {
  const pathname = usePathname()
  const onAllowedPath = isPlanUpgradeBypassPath(pathname)
  const showBlocker = lock != null && !onAllowedPath

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <div
        className={`flex min-h-0 flex-1 overflow-hidden ${
          showBlocker ? 'pointer-events-none select-none blur-[2px]' : ''
        }`}
        aria-hidden={showBlocker}
      >
        {children}
      </div>

      {showBlocker && lock && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-signara-navy/40 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="plan-upgrade-lock-title"
            aria-describedby="plan-upgrade-lock-description"
            className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-signara-steel/30 bg-white shadow-xl"
          >
            <div className="border-b border-t-2 border-t-signara-gold border-signara-steel/20 px-6 pt-6 pb-4 text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-amber-100">
                <AlertCircle className="size-6 text-amber-700" />
              </div>
              <h2 id="plan-upgrade-lock-title" className="text-xl font-bold text-signara-navy">
                {getPlanUpgradeLockTitle(lock.reason)}
              </h2>
              <p id="plan-upgrade-lock-description" className="mt-2 text-sm text-signara-steel">
                {getPlanUpgradeLockDescription(lock)}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="rounded-lg border border-signara-steel/30 bg-signara-background/60 px-4 py-3">
                <p className="text-sm font-medium text-signara-navy">
                  Upgrade to {lock.requiredPlanName} to unlock:
                </p>
                <ul className="mt-3 space-y-2">
                  {lock.upgradeFeatures.map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm text-signara-navy">
                      <Check className="mt-0.5 size-4 shrink-0 text-signara-gold" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {!isAdmin && (
                <p className="mt-4 text-sm text-signara-steel">
                  Ask your organisation admin to upgrade the plan. Billing settings remain available
                  so they can choose a new plan.
                </p>
              )}
            </div>

            <div className="space-y-2 border-t border-signara-steel/20 px-6 py-4">
              {isAdmin ? (
                <Button asChild variant="signara" className="w-full">
                  <Link href="/dashboard/settings/billing">Go to billing settings</Link>
                </Button>
              ) : (
                <Button asChild variant="signara" className="w-full">
                  <Link href="/dashboard/settings/billing">View billing settings</Link>
                </Button>
              )}
              <p className="text-center text-xs text-signara-steel">
                Upgrade on the billing page to restore access to Signara.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
