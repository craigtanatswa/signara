'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Smartphone, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface PaynowCheckoutButtonProps {
  planId: 'starter' | 'growth' | 'enterprise'
  disabled?: boolean
}

export function PaynowCheckoutButton({ planId, disabled }: PaynowCheckoutButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handlePaynow() {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/paynow/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to initiate payment')
      window.location.href = data.redirectUrl
    } catch (error) {
      toast.error('Payment error', {
        description: error instanceof Error ? error.message : 'Something went wrong',
      })
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handlePaynow}
      disabled={disabled || loading}
      variant="signara"
      className="w-full"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecting to Paynow...
        </>
      ) : (
        <>
          <Smartphone className="mr-2 h-4 w-4" /> Pay with EcoCash / Paynow
        </>
      )}
    </Button>
  )
}
