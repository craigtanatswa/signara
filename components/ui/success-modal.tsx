'use client'

import { CircleCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface SuccessModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  onConfirm?: () => void
}

export function SuccessModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Done',
  onConfirm,
}: SuccessModalProps) {
  function handleConfirm() {
    onConfirm?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader className="items-center text-center sm:items-center sm:text-center">
          <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-signara-gold/15">
            <CircleCheck className="size-7 text-signara-gold" />
          </div>
          <DialogTitle className="text-signara-navy">{title}</DialogTitle>
          <DialogDescription className="text-signara-steel">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button variant="signara" className="min-w-28" onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
