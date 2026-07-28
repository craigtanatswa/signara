'use client'

import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface PaymentResultModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  variant: 'success' | 'failure'
  title: string
  description: string
  receiptEmail?: string | null
}

export function PaymentResultModal({
  open,
  onOpenChange,
  variant,
  title,
  description,
  receiptEmail,
}: PaymentResultModalProps) {
  const isSuccess = variant === 'success'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader className="items-center text-center sm:items-center sm:text-center">
          <div
            className={`mx-auto mb-2 flex size-14 items-center justify-center rounded-full ${
              isSuccess ? 'bg-green-100' : 'bg-red-100'
            }`}
          >
            {isSuccess ? (
              <Check className="size-7 text-green-700" />
            ) : (
              <X className="size-7 text-red-600" strokeWidth={2.5} />
            )}
          </div>
          <DialogTitle className="text-signara-navy">{title}</DialogTitle>
          <DialogDescription className="text-signara-steel">{description}</DialogDescription>
          {isSuccess && receiptEmail && (
            <p className="mt-2 text-sm text-signara-navy">
              A receipt has been sent to <strong>{receiptEmail}</strong>.
            </p>
          )}
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          {isSuccess ? (
            <Button asChild variant="signara" className="min-w-28">
              <Link href="/dashboard/settings/billing">Go to billing</Link>
            </Button>
          ) : (
            <Button variant="signara" className="min-w-28" onClick={() => onOpenChange(false)}>
              Try again
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
