'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, PlayCircle, Save, XCircle } from 'lucide-react'
import {
  cancelDocument,
  saveInitiatorSignature,
  submitDocumentForApproval,
} from '@/app/actions/documents'
import { SignaturePad } from '@/components/documents/signature-pad'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/error-message'

interface InitiatorDocumentPanelProps {
  documentId: string
  initiatorFieldLabel: string | null
  existingSignature: string | null
  mode: 'draft' | 'submitted' | 'cancel-only'
}

export function InitiatorDocumentPanel({
  documentId,
  initiatorFieldLabel,
  existingSignature,
  mode,
}: InitiatorDocumentPanelProps) {
  const router = useRouter()
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(existingSignature)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const requiresInitiatorSignature = Boolean(initiatorFieldLabel)
  const hasSavedSignature = Boolean(existingSignature)
  const hasUnsavedSignature = Boolean(signatureDataUrl && signatureDataUrl !== existingSignature)

  useEffect(() => {
    setSignatureDataUrl(existingSignature)
  }, [existingSignature])

  function handleSaveSignature() {
    setError(null)
    startTransition(async () => {
      const result = await saveInitiatorSignature({
        documentId,
        signatureDataUrl,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      toast.success('Signature saved')
      router.refresh()
    })
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
          ? 'Sign below, then submit for approval. You can update your signature while this document is still a draft.'
          : 'Review your document, then submit for approval. You can cancel while this document is still a draft.'}
      </p>

      {initiatorFieldLabel && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-signara-navy">
            {initiatorFieldLabel}
            <span className="ml-1 text-red-500">*</span>
          </p>
          <SignaturePad onChange={setSignatureDataUrl} />
          <Button
            type="button"
            variant="outline"
            disabled={isPending || !signatureDataUrl}
            onClick={handleSaveSignature}
            className="border-signara-navy text-signara-navy hover:bg-signara-navy hover:text-white"
          >
            {isPending ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 size-4" />
            )}
            Save signature
          </Button>
          {hasUnsavedSignature && (
            <p className="text-xs text-amber-700">
              You have an unsaved signature — click Save signature, or Submit will save it for you.
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
