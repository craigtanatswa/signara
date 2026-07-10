'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, PlayCircle, RotateCcw, XCircle } from 'lucide-react'
import {
  cancelDocument,
  resubmitDocument,
  saveInitiatorSignature,
  submitDocumentForApproval,
} from '@/app/actions/documents'
import { saveSignatureForFutureUse } from '@/lib/signatures/save-for-future-use'
import { SignaturePad } from '@/components/documents/signature-pad'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/error-message'
import type { SignatureCaptureMethod } from '@/types/database'

interface InitiatorDocumentPanelProps {
  documentId: string
  initiatorFieldLabel: string | null
  existingSignature: string | null
  mode: 'draft' | 'submitted' | 'cancel-only' | 'rejected'
  rejectionReason?: string | null
}

export function InitiatorDocumentPanel({
  documentId,
  initiatorFieldLabel,
  existingSignature,
  mode,
  rejectionReason,
}: InitiatorDocumentPanelProps) {
  const router = useRouter()
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(existingSignature)
  const [signatureMethod, setSignatureMethod] = useState<SignatureCaptureMethod>('draw')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const requiresInitiatorSignature = Boolean(initiatorFieldLabel)
  const hasSavedSignature = Boolean(existingSignature)
  const hasUnsavedSignature = Boolean(signatureDataUrl && signatureDataUrl !== existingSignature)

  useEffect(() => {
    setSignatureDataUrl(existingSignature)
  }, [existingSignature])

  async function handleSaveToDocument(dataUrl: string, _method: SignatureCaptureMethod) {
    setError(null)
    const result = await saveInitiatorSignature({
      documentId,
      signatureDataUrl: dataUrl,
    })
    if (result.error) {
      throw new Error(result.error)
    }
    router.refresh()
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      if (requiresInitiatorSignature) {
        if (!signatureDataUrl && !hasSavedSignature) {
          setError('Please sign in the box below before submitting.')
          return
        }

        if (hasUnsavedSignature || (!hasSavedSignature && signatureDataUrl)) {
          const saveResult = await saveInitiatorSignature({
            documentId,
            signatureDataUrl,
          })
          if (saveResult.error) {
            setError(saveResult.error)
            return
          }
        }
      }

      const result = await submitDocumentForApproval(documentId)
      if (result.error) {
        setError(result.error)
        return
      }
      await saveSignatureForFutureUse(signatureDataUrl, signatureMethod)
      toast.success('Document submitted for approval')
      router.refresh()
    })
  }

  function handleCancel() {
    setError(null)
    startTransition(async () => {
      const result = await cancelDocument(documentId)
      if (result.error) {
        setError(result.error)
        return
      }
      toast.success('Document cancelled')
      router.refresh()
    })
  }

  function handleResubmit() {
    setError(null)
    startTransition(async () => {
      const result = await resubmitDocument(documentId)
      if (result.error) {
        setError(result.error)
        return
      }
      toast.success('Document reopened as a draft — make your changes, then submit again')
      router.refresh()
    })
  }

  if (mode === 'rejected') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-5">
        <p className="text-sm font-semibold text-red-900">This document was rejected</p>
        {rejectionReason && (
          <p className="mt-2 rounded-md border border-red-200 bg-white/70 px-3 py-2 text-sm text-red-900">
            Reason: {rejectionReason}
          </p>
        )}
        <p className="mt-2 text-sm text-red-800/80">
          Make any needed changes, then resubmit to restart the approval chain from the first step.
        </p>
        {error && (
          <div className="mt-3">
            <ErrorMessage>{error}</ErrorMessage>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" variant="signara" disabled={isPending} onClick={handleResubmit}>
            {isPending ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-1.5 size-4" />
            )}
            Make changes and resubmit
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={handleCancel}
            className="border-destructive text-destructive hover:bg-destructive hover:text-white"
          >
            <XCircle className="mr-1.5 size-4" />
            Cancel document
          </Button>
        </div>
      </div>
    )
  }

  if (mode === 'cancel-only' || mode === 'submitted') {
    return (
      <div className="rounded-lg border border-signara-steel/30 bg-white p-5 shadow-sm">
        <p className="text-sm text-signara-navy">
          {mode === 'cancel-only'
            ? 'This document was rejected. You can cancel it to withdraw it from the approval process.'
            : 'This document is awaiting its first approval. You can cancel it before anyone approves.'}
        </p>
        {error && (
          <div className="mt-3">
            <ErrorMessage>{error}</ErrorMessage>
          </div>
        )}
        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={handleCancel}
            className="border-destructive text-destructive hover:bg-destructive hover:text-white"
          >
            {isPending ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <XCircle className="mr-1.5 size-4" />
            )}
            Cancel document
          </Button>
        </div>
      </div>
    )
  }

  const canSubmit =
    !requiresInitiatorSignature || hasSavedSignature || Boolean(signatureDataUrl)

  return (
    <div className="rounded-lg border border-signara-gold/40 bg-signara-gold/5 p-5">
      <p className="text-sm font-semibold text-signara-navy">Draft — finish before submitting</p>
      <p className="mt-1 text-sm text-signara-steel">
        {requiresInitiatorSignature
          ? hasSavedSignature
            ? 'Your initiator signature is ready. Submit for approval, or clear and re-sign if needed.'
            : 'Sign below, then submit for approval. Your signature is saved for this document and for future use.'
          : 'Review your document, then submit for approval. You can cancel while this document is still a draft.'}
      </p>

      {initiatorFieldLabel && (
        <div className="mt-4 space-y-2">
          <SignaturePad
            label={initiatorFieldLabel}
            value={signatureDataUrl}
            onChange={(dataUrl, method) => {
              setSignatureDataUrl(dataUrl)
              if (method) setSignatureMethod(method)
            }}
            onSave={handleSaveToDocument}
          />
          {hasSavedSignature && !hasUnsavedSignature && (
            <p className="text-xs text-signara-steel">
              Signature is saved on this document. Clear above if you need to re-sign.
            </p>
          )}
          {hasUnsavedSignature && (
            <p className="text-xs text-amber-700">
              Click Save to store this signature on the document, or Submit will save it for you.
            </p>
          )}
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
          disabled={isPending || !canSubmit}
          onClick={handleSubmit}
        >
          {isPending ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" />
          ) : (
            <PlayCircle className="mr-1.5 size-4" />
          )}
          Submit for approval
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={handleCancel}
          className="border-destructive text-destructive hover:bg-destructive hover:text-white"
        >
          <XCircle className="mr-1.5 size-4" />
          Cancel draft
        </Button>
      </div>
    </div>
  )
}
