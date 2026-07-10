'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, MessageSquarePlus, XCircle } from 'lucide-react'
import { approveDocumentStep, rejectDocumentStep } from '@/app/actions/approvals'
import { saveSignatureForFutureUse } from '@/lib/signatures/save-for-future-use'
import { SignaturePad } from '@/components/documents/signature-pad'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ErrorMessage } from '@/components/ui/error-message'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { SignatureCaptureMethod } from '@/types/database'

interface ApprovalPanelProps {
  documentId: string
  stepId: string
  authorityText: string
  requiresSignature: boolean
}

export function ApprovalPanel({ documentId, stepId, authorityText, requiresSignature }: ApprovalPanelProps) {
  const router = useRouter()
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [signatureMethod, setSignatureMethod] = useState<SignatureCaptureMethod>('draw')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const canApprove = !requiresSignature || Boolean(signatureDataUrl)
  const rejectReasonValid = rejectReason.trim().length >= 10

  function handleApprove() {
    setError(null)
    startTransition(async () => {
      const result = await approveDocumentStep({ documentId, stepId, signatureDataUrl })
      if (result.error) {
        setError(result.error)
        return
      }
      await saveSignatureForFutureUse(signatureDataUrl, signatureMethod)
      toast.success('Approved')
      router.refresh()
    })
  }

  function handleReject() {
    setError(null)
    if (!rejectReasonValid) {
      setError('Please provide a reason of at least 10 characters.')
      return
    }
    startTransition(async () => {
      const result = await rejectDocumentStep({ documentId, stepId, reason: rejectReason })
      if (result.error) {
        setError(result.error)
        return
      }
      setRejectOpen(false)
      toast.success('Document rejected')
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border border-signara-gold/40 bg-signara-gold/5 p-5">
      <p className="text-sm font-semibold text-signara-navy">
        This document is waiting for your approval
      </p>
      {authorityText && <p className="mt-1 text-sm text-signara-navy/80">{authorityText}</p>}

      {requiresSignature && (
        <div className="mt-4">
          <SignaturePad
            onChange={(dataUrl, method) => {
              setSignatureDataUrl(dataUrl)
              if (method) setSignatureMethod(method)
            }}
          />
        </div>
      )}

      {error && (
        <div className="mt-3">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="signara"
          disabled={isPending || !canApprove}
          onClick={handleApprove}
        >
          {isPending ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-1.5 size-4" />
          )}
          Approve & Sign
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => {
            setError(null)
            setRejectOpen(true)
          }}
          className="border-destructive text-destructive hover:bg-destructive hover:text-white"
        >
          <XCircle className="mr-1.5 size-4" />
          Reject
        </Button>
        <Button type="button" variant="outline" disabled title="Coming soon">
          <MessageSquarePlus className="mr-1.5 size-4" />
          Request consultation
        </Button>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this document?</DialogTitle>
            <DialogDescription>
              The document will be marked as rejected and the initiator will be notified. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-reason" className="text-signara-navy font-medium">
              Reason <span className="text-signara-steel font-normal">(min. 10 characters)</span>
            </Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this document is being rejected"
              className="min-h-24 border-signara-steel focus-visible:ring-signara-navy"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isPending || !rejectReasonValid}
            >
              {isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Reject document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
