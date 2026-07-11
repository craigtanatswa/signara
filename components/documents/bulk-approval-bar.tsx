'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { approveDocumentStepsBatch } from '@/app/actions/approvals'
import { SignaturePad } from '@/components/documents/signature-pad'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/error-message'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { AwaitingDocumentRow } from '@/components/documents/documents-tabs'
import type { SignatureCaptureMethod } from '@/types/database'

interface BulkApprovalBarProps {
  selected: AwaitingDocumentRow[]
  onClearSelection: () => void
}

export function BulkApprovalBar({ selected, onClearSelection }: BulkApprovalBarProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [signatureMethod, setSignatureMethod] = useState<SignatureCaptureMethod>('draw')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const requiresSignature = useMemo(
    () => selected.some((row) => row.requiresSignature),
    [selected]
  )

  const canApprove = selected.length > 0 && (!requiresSignature || Boolean(signatureDataUrl))

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setError(null)
      setSignatureDataUrl(null)
    }
  }

  function handleApprove() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await approveDocumentStepsBatch({
          items: selected.map((row) => ({
            documentId: row.id,
            stepId: row.stepId,
          })),
          signatureDataUrl,
          signatureMethod,
        })

        if (result.error) {
          setError(result.error)
          return
        }

        if (result.approved > 0) {
          toast.success(
            result.approved === 1
              ? '1 document approved'
              : `${result.approved} documents approved`
          )
        }

        if (result.failed.length > 0) {
          toast.error(
            result.failed.length === 1
              ? `1 document could not be approved: ${result.failed[0].error}`
              : `${result.failed.length} documents could not be approved`
          )
        }

        setOpen(false)
        setSignatureDataUrl(null)
        onClearSelection()
        router.refresh()
      } catch (err) {
        console.error('[BulkApprovalBar] approve failed', err)
        setError(
          err instanceof Error && err.message
            ? err.message
            : 'Approval failed. Please try again.'
        )
      }
    })
  }

  if (selected.length === 0) return null

  return (
    <>
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-signara-gold/40 bg-white px-4 py-3 shadow-md">
        <p className="text-sm font-medium text-signara-navy">
          {selected.length} selected
          {requiresSignature && (
            <span className="ml-2 font-normal text-signara-steel">
              — signature required
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onClearSelection}>
            Clear
          </Button>
          <Button type="button" variant="signara" onClick={() => setOpen(true)}>
            <CheckCircle2 className="mr-1.5 size-4" />
            Approve selected
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Approve {selected.length} document{selected.length === 1 ? '' : 's'}?
            </DialogTitle>
            <DialogDescription>
              {requiresSignature
                ? 'Provide one signature to apply to every selected document that requires it.'
                : 'These documents will be approved with your authority.'}
            </DialogDescription>
          </DialogHeader>

          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-signara-steel/20 bg-signara-background/50 px-3 py-2 text-sm text-signara-navy">
            {selected.map((row) => (
              <li key={row.id} className="truncate">
                {row.title}
                {row.requiresSignature && (
                  <span className="ml-1 text-xs text-signara-steel">(signature)</span>
                )}
              </li>
            ))}
          </ul>

          {requiresSignature && (
            <SignaturePad
              value={signatureDataUrl}
              onChange={(dataUrl, method) => {
                setSignatureDataUrl(dataUrl)
                if (method) setSignatureMethod(method)
              }}
              label="Signature for all selected"
            />
          )}

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="signara" onClick={handleApprove} disabled={isPending || !canApprove}>
              {isPending ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 size-4" />
              )}
              Approve {selected.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
