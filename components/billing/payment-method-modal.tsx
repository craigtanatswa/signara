'use client'

import { CreditCard, Smartphone } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface PaymentMethodModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: 'starter' | 'growth' | 'enterprise'
}

export function PaymentMethodModal({ open, onOpenChange, planId }: PaymentMethodModalProps) {
  const router = useRouter()

  function choose(method: 'ecocash' | 'card') {
    onOpenChange(false)
    router.push(`/dashboard/settings/billing/checkout/${method}?planId=${planId}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-signara-navy">Choose payment method</DialogTitle>
          <DialogDescription className="text-signara-steel">
            Pay securely with EcoCash or card via Paynow.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <button
            type="button"
            onClick={() => choose('ecocash')}
            className="flex items-start gap-4 rounded-lg border border-signara-steel/30 bg-white p-4 text-left shadow-sm transition-colors hover:border-signara-gold hover:bg-signara-gold/5"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-signara-navy/10">
              <Smartphone className="size-5 text-signara-navy" />
            </div>
            <div>
              <p className="font-semibold text-signara-navy">EcoCash</p>
              <p className="mt-0.5 text-sm text-signara-steel">
                Enter your number and approve the prompt on your phone.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => choose('card')}
            className="flex items-start gap-4 rounded-lg border border-signara-steel/30 bg-white p-4 text-left shadow-sm transition-colors hover:border-signara-gold hover:bg-signara-gold/5"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-signara-navy/10">
              <CreditCard className="size-5 text-signara-navy" />
            </div>
            <div>
              <p className="font-semibold text-signara-navy">Card</p>
              <p className="mt-0.5 text-sm text-signara-steel">
                Visa, Mastercard or Zimswitch via Paynow&apos;s secure checkout.
              </p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
