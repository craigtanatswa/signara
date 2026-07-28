'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, CreditCard, Loader2, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ReceiptEmailField } from '@/components/billing/receipt-email-field'
import { PaymentResultModal } from '@/components/billing/payment-result-modal'
import { formatDocumentLimit, formatUserLimit } from '@/lib/billing/plans'

export interface CheckoutPlan {
  id: string
  name: string
  price_usd: number | null
  max_users: number | null
  max_documents_per_month: number | null
  features: string[]
}

interface CheckoutClientProps {
  method: 'ecocash' | 'card'
  plan: CheckoutPlan
  defaultReceiptEmail: string
  receiptEmailHistory: string[]
}

export function CheckoutClient({
  method,
  plan,
  defaultReceiptEmail,
  receiptEmailHistory,
}: CheckoutClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [receiptEmail, setReceiptEmail] = useState(defaultReceiptEmail)
  const [phone, setPhone] = useState('')
  const [pending, startTransition] = useTransition()
  const [waiting, setWaiting] = useState(false)
  const [instructions, setInstructions] = useState<string | null>(null)
  const [activeReference, setActiveReference] = useState<string | null>(
    searchParams.get('reference')
  )
  const [resultOpen, setResultOpen] = useState(false)
  const [resultVariant, setResultVariant] = useState<'success' | 'failure'>('success')
  const [resultTitle, setResultTitle] = useState('')
  const [resultDescription, setResultDescription] = useState('')
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const history = useMemo(() => {
    const set = new Set(receiptEmailHistory.map((e) => e.toLowerCase()))
    if (defaultReceiptEmail && !set.has(defaultReceiptEmail.toLowerCase())) {
      return [defaultReceiptEmail, ...receiptEmailHistory]
    }
    return receiptEmailHistory
  }, [defaultReceiptEmail, receiptEmailHistory])

  function stopPolling() {
    if (pollTimer.current) {
      clearInterval(pollTimer.current)
      pollTimer.current = null
    }
  }

  function showSuccess() {
    stopPolling()
    setWaiting(false)
    setResultVariant('success')
    setResultTitle('Payment successful')
    setResultDescription(
      `Your ${plan.name} plan is now active. Welcome to Signara ${plan.name}.`
    )
    setResultOpen(true)
    router.refresh()
  }

  function showFailure(message: string) {
    stopPolling()
    setWaiting(false)
    setResultVariant('failure')
    setResultTitle('Payment failed')
    setResultDescription(message)
    setResultOpen(true)
  }

  async function checkStatus(reference: string) {
    const res = await fetch('/api/billing/paynow/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Could not check payment status')
    return data as {
      paid: boolean
      failed: boolean
      error?: string
      status: string
    }
  }

  function startPolling(reference: string) {
    stopPolling()
    setWaiting(true)
    setActiveReference(reference)

    pollTimer.current = setInterval(async () => {
      try {
        const data = await checkStatus(reference)
        if (data.paid) showSuccess()
        else if (data.failed) showFailure(data.error || 'Payment was not completed.')
      } catch (err) {
        console.error('[checkout poll]', err)
      }
    }, 4000)
  }

  useEffect(() => {
    const reference = searchParams.get('reference')
    const status = searchParams.get('status')
    if (method === 'card' && reference && status === 'return') {
      setWaiting(true)
      setActiveReference(reference)
      void (async () => {
        try {
          // Give Paynow a moment, then poll
          await new Promise((r) => setTimeout(r, 1500))
          const data = await checkStatus(reference)
          if (data.paid) showSuccess()
          else if (data.failed) showFailure(data.error || 'Payment was not completed.')
          else startPolling(reference)
        } catch (err) {
          showFailure(err instanceof Error ? err.message : 'Could not confirm payment')
        }
      })()
    }

    return () => stopPolling()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handlePay() {
    if (!receiptEmail.trim()) {
      toast.error('Enter a receipt email address')
      return
    }
    if (method === 'ecocash' && !phone.trim()) {
      toast.error('Enter your EcoCash phone number')
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/billing/paynow/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId: plan.id,
            method,
            receiptEmail: receiptEmail.trim(),
            phone: method === 'ecocash' ? phone.trim() : undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to start payment')

        if (method === 'card') {
          window.location.href = data.redirectUrl
          return
        }

        setInstructions(
          data.instructions ||
            'Check your phone for the EcoCash prompt and enter your PIN to complete payment.'
        )
        startPolling(data.reference)
      } catch (err) {
        showFailure(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  const MethodIcon = method === 'ecocash' ? Smartphone : CreditCard

  return (
    <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-2">
        <div className="rounded-lg border border-signara-steel/30 border-t-2 border-t-signara-gold bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-signara-steel">Upgrading to</p>
          <h2 className="mt-1 text-2xl font-bold text-signara-navy">{plan.name}</h2>
          <p className="mt-2 text-3xl font-bold text-signara-navy">
            ${plan.price_usd ?? 0}
            <span className="text-sm font-normal text-signara-steel"> / month</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm text-signara-navy">
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-signara-gold" />
              {formatUserLimit(plan.max_users)} team members
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-signara-gold" />
              {formatDocumentLimit(plan.max_documents_per_month)} documents / month
            </li>
            {plan.features.map((feature) => (
              <li key={feature} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-signara-gold" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-4 lg:col-span-3">
        <div className="rounded-lg border border-signara-steel/30 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-signara-navy/10">
              <MethodIcon className="size-5 text-signara-navy" />
            </div>
            <div>
              <h3 className="font-semibold text-signara-navy">
                {method === 'ecocash' ? 'Pay with EcoCash' : 'Pay with card'}
              </h3>
              <p className="text-sm text-signara-steel">
                {method === 'ecocash'
                  ? 'Approve the payment prompt on your phone'
                  : 'You will enter card details on Paynow\'s secure page'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <ReceiptEmailField
              value={receiptEmail}
              onChange={setReceiptEmail}
              history={history}
            />

            {method === 'ecocash' && (
              <div className="space-y-1.5">
                <Label htmlFor="ecocash-phone" className="text-signara-navy font-medium">
                  EcoCash phone number
                </Label>
                <Input
                  id="ecocash-phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="0771234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={waiting || pending}
                  className="border-signara-steel focus-visible:ring-signara-navy"
                />
                <p className="text-xs text-signara-steel">
                  EcoCash will send a PIN prompt to this number.
                </p>
              </div>
            )}

            {waiting && (
              <div className="rounded-lg border border-signara-navy/20 bg-signara-navy/5 px-4 py-3 text-sm text-signara-navy">
                <div className="flex items-center gap-2 font-medium">
                  <Loader2 className="size-4 animate-spin" />
                  Waiting for payment…
                </div>
                <p className="mt-1 text-signara-steel">
                  {instructions ||
                    (method === 'card'
                      ? 'Confirming your card payment with Paynow.'
                      : 'Approve the EcoCash prompt on your phone.')}
                </p>
                {activeReference && (
                  <p className="mt-2 text-xs text-signara-steel">Ref: {activeReference}</p>
                )}
              </div>
            )}

            <Button
              type="button"
              variant="signara"
              className="w-full"
              disabled={pending || waiting}
              onClick={handlePay}
            >
              {pending || waiting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {method === 'card' && pending ? 'Redirecting…' : 'Processing…'}
                </>
              ) : method === 'ecocash' ? (
                'Pay & wait for phone prompt'
              ) : (
                'Continue to secure card payment'
              )}
            </Button>
          </div>
        </div>
      </div>

      <PaymentResultModal
        open={resultOpen}
        onOpenChange={setResultOpen}
        variant={resultVariant}
        title={resultTitle}
        description={resultDescription}
        receiptEmail={resultVariant === 'success' ? receiptEmail : null}
      />
    </div>
  )
}
