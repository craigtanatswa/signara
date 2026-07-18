'use client'

import Link from 'next/link'
import { AlertCircle, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getPlanLimitDescription,
  getPlanLimitHeadline,
  getPlanLimitUpgradeIntro,
  type PlanLimitReachedDetails,
} from '@/lib/billing/plan-limit-response'

interface PlanLimitReachedModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  details: PlanLimitReachedDetails | null
}

export function PlanLimitReachedModal({
  open,
  onOpenChange,
  details,
}: PlanLimitReachedModalProps) {
  if (!details) return null

  const headline = getPlanLimitHeadline(details.type)
  const description = getPlanLimitDescription(details)
  const upgradeIntro = getPlanLimitUpgradeIntro(details)
  const featureList =
    details.upgradeFeatures.length > 0
      ? details.upgradeFeatures
      : [
          'Higher monthly document allowance',
          'More team members on one account',
          'Advanced approval workflows',
          'Organisation branding',
        ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]">
        <DialogHeader className="shrink-0 border-b border-t-2 border-t-signara-gold border-signara-steel/20 px-6 pt-6 pb-4">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-amber-100">
            <AlertCircle className="size-6 text-amber-700" />
          </div>
          <DialogTitle className="text-center text-signara-navy">{headline}</DialogTitle>
          <DialogDescription className="text-center text-signara-steel">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="rounded-lg border border-signara-steel/30 bg-signara-background/60 px-4 py-3">
            <p className="text-sm font-medium text-signara-navy">{upgradeIntro}</p>
            <ul className="mt-3 space-y-2">
              {featureList.map((feature) => (
                <li key={feature} className="flex gap-2 text-sm text-signara-navy">
                  <Check className="mt-0.5 size-4 shrink-0 text-signara-gold" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {!details.canUpgrade && (
            <p className="text-sm text-signara-steel">
              Ask your organisation admin to upgrade your plan so you can use this feature again.
            </p>
          )}
        </div>

        <DialogFooter className="shrink-0 flex-col gap-2 border-t border-signara-steel/20 px-6 py-4 sm:flex-col">
          {details.canUpgrade ? (
            <Button asChild variant="signara" className="w-full">
              <Link href="/dashboard/settings/billing" onClick={() => onOpenChange(false)}>
                View plans &amp; upgrade
              </Link>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="w-full border-signara-navy text-signara-navy hover:bg-signara-navy hover:text-white"
            onClick={() => onOpenChange(false)}
          >
            {details.canUpgrade ? 'Not now' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
