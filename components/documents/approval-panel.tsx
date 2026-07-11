'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Download,
  Loader2,
  MessageSquarePlus,
  PenLine,
  Printer,
  Upload,
  XCircle,
} from 'lucide-react'
import { approveDocumentStep, rejectDocumentStep } from '@/app/actions/approvals'
import { completeWithPhysicalSignature } from '@/app/actions/physical-signature'
import { compressPhysicalSignatureFile } from '@/lib/signatures/compress-physical-upload'
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

type SigningMode = 'choose' | 'digital' | 'physical'

interface ApprovalPanelProps {
  documentId: string
  stepId: string
  authorityText: string
  requiresSignature: boolean
  /** Only the final signatory may print-and-sign physically. */
  isFinalStep?: boolean
}

export function ApprovalPanel({
  documentId,
  stepId,
  authorityText,
  requiresSignature,
  isFinalStep = false,
}: ApprovalPanelProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [signingMode, setSigningMode] = useState<SigningMode>(isFinalStep ? 'choose' : 'digital')
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [signatureMethod, setSignatureMethod] = useState<SignatureCaptureMethod>('draw')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [downloadPending, setDownloadPending] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isPending, startTransition] = useTransition()

  const canApprove = !requiresSignature || Boolean(signatureDataUrl)
  const rejectReasonValid = rejectReason.trim().length >= 10

  function handleApprove() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await approveDocumentStep({
          documentId,
          stepId,
          signatureDataUrl,
          signatureMethod,
        })
        if (result.error) {
          setError(result.error)
          return
        }
        toast.success('Approved')
        router.refresh()
      } catch (err) {
        console.error('[ApprovalPanel] approve failed', err)
        setError(
          err instanceof Error && err.message
            ? err.message
            : 'Approval failed. Please try again.'
        )
      }
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

  async function handleDownloadPrintVersion() {
    setError(null)
    setDownloadPending(true)
    try {
      const response = await fetch(`/api/documents/${documentId}/print-version`)
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? 'Failed to download print-ready PDF.')
        return
      }

      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition') ?? ''
      const match = /filename="([^"]+)"/.exec(disposition)
      const filename = match?.[1] ?? 'print-and-sign.pdf'
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast.success('Print-ready PDF downloaded')
    } catch {
      setError('Failed to download print-ready PDF.')
    } finally {
      setDownloadPending(false)
    }
  }

  function handlePhysicalUpload() {
    setError(null)
    if (!selectedFile) {
      setError('Please choose a photo or scan of the signed document.')
      return
    }
    startTransition(async () => {
      try {
        const uploadFile = await compressPhysicalSignatureFile(selectedFile)
        const formData = new FormData()
        formData.set('documentId', documentId)
        formData.set('stepId', stepId)
        formData.set('uploadedFile', uploadFile)
        const result = await completeWithPhysicalSignature(formData)
        if (result.error) {
          setError(result.error)
          return
        }
        toast.success('Document completed with physical signature')
        router.refresh()
      } catch (err) {
        console.error('[ApprovalPanel] physical upload failed', err)
        setError(
          err instanceof Error && err.message
            ? err.message
            : 'Upload failed. Please try again.'
        )
      }
    })
  }

  return (
    <div className="rounded-lg border border-signara-gold/40 bg-signara-gold/5 p-5">
      <p className="text-sm font-semibold text-signara-navy">
        This document is waiting for your approval
      </p>
      {authorityText && <p className="mt-1 text-sm text-signara-navy/80">{authorityText}</p>}

      {signingMode === 'choose' && isFinalStep && (
        <div className="mt-5 space-y-4">
          <p className="text-sm text-signara-navy/90">
            As the final signatory, you can sign digitally or print and sign by hand.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setError(null)
                setSigningMode('digital')
              }}
              className="rounded-lg border border-signara-steel/40 bg-white p-4 text-left shadow-sm transition hover:border-signara-gold"
            >
              <div className="flex items-center gap-2 text-signara-navy">
                <PenLine className="size-4 text-signara-gold" />
                <span className="font-semibold">Sign digitally</span>
              </div>
              <p className="mt-2 text-xs text-signara-steel">
                Capture your signature on screen to complete this document.
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null)
                setSigningMode('physical')
                void handleDownloadPrintVersion()
              }}
              className="rounded-lg border border-signara-steel/40 bg-white p-4 text-left shadow-sm transition hover:border-signara-navy"
            >
              <div className="flex items-center gap-2 text-signara-navy">
                <Printer className="size-4 text-signara-navy" />
                <span className="font-semibold">Print and sign physically</span>
              </div>
              <p className="mt-2 text-xs text-signara-steel">
                Download a printable version with all prior signatures, sign it by hand, then upload
                a photo or scan to complete this document.
              </p>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
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
          </div>
        </div>
      )}

      {signingMode === 'digital' && (
        <>
          {isFinalStep && (
            <button
              type="button"
              className="mt-3 text-xs text-signara-gold hover:underline"
              onClick={() => {
                setError(null)
                setSigningMode('choose')
              }}
            >
              ← Back to signing options
            </button>
          )}

          {requiresSignature && (
            <div className="mt-4">
              <SignaturePad
                value={signatureDataUrl}
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
        </>
      )}

      {signingMode === 'physical' && isFinalStep && (
        <div className="mt-4 space-y-4">
          <button
            type="button"
            className="text-xs text-signara-gold hover:underline"
            onClick={() => {
              setError(null)
              setSigningMode('choose')
            }}
          >
            ← Back to signing options
          </button>

          <p className="text-sm text-signara-navy/80">
            Download a printable version with all prior signatures, sign it by hand, then upload a
            photo or scan to complete this document.
          </p>

          <Button
            type="button"
            variant="outline"
            disabled={isPending || downloadPending}
            onClick={handleDownloadPrintVersion}
            className="border-signara-navy text-signara-navy hover:bg-signara-navy hover:text-white"
          >
            {downloadPending ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Download className="mr-1.5 size-4" />
            )}
            Download print-ready PDF
          </Button>

          <div className="rounded-md border border-signara-steel/30 bg-white p-4">
            <Label htmlFor="physical-signature-upload" className="text-signara-navy font-medium">
              Upload your signed copy
            </Label>
            <p className="mt-1 text-xs text-signara-steel">Accepts images or PDF, max 10 MB.</p>
            <input
              ref={fileInputRef}
              id="physical-signature-upload"
              type="file"
              accept="image/*,application/pdf"
              className="mt-3 block w-full text-sm text-signara-navy file:mr-3 file:rounded-md file:border-0 file:bg-signara-navy file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
              onChange={(e) => {
                setError(null)
                setSelectedFile(e.target.files?.[0] ?? null)
              }}
            />
            {selectedFile && (
              <p className="mt-2 text-xs text-signara-steel">
                Selected: {selectedFile.name} ({Math.ceil(selectedFile.size / 1024)} KB)
              </p>
            )}
            <Button
              type="button"
              variant="signara"
              className="mt-4"
              disabled={isPending || !selectedFile}
              onClick={handlePhysicalUpload}
            >
              {isPending ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Upload className="mr-1.5 size-4" />
              )}
              Complete with physical signature
            </Button>
          </div>

          {error && (
            <div className="mt-3">
              <ErrorMessage>{error}</ErrorMessage>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
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
          </div>
        </div>
      )}

      {signingMode === 'choose' && error && (
        <div className="mt-3">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}

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
