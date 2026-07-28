'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Smartphone } from 'lucide-react'
import { PaymentMethodModal } from '@/components/billing/payment-method-modal'

interface PaynowCheckoutButtonProps {
  planId: 'starter' | 'growth' | 'enterprise'
  disabled?: boolean
}

export function PaynowCheckoutButton({ planId, disabled }: PaynowCheckoutButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        disabled={disabled}
        variant="signara"
        className="w-full"
      >
        <Smartphone className="mr-2 h-4 w-4" /> Pay with Ecocash / Card
      </Button>
      <PaymentMethodModal open={open} onOpenChange={setOpen} planId={planId} />
    </>
  )
}
