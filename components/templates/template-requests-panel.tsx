'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ExternalLink, FileText, Loader2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  dismissTemplateRequest,
  fulfillTemplateRequest,
  getTemplateRequestAttachmentSignedUrl,
  type TemplateRequestListItem,
} from '@/app/actions/template-requests'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/error-message'
import { JOB_LEVEL_LABELS } from '@/types/org-structure'

interface TemplateRequestsPanelProps {
  requests: TemplateRequestListItem[]
}

export function TemplateRequestsPanel({ requests }: TemplateRequestsPanelProps) {
  if (requests.length === 0) return null

  return (
    <div className="rounded-lg border border-signara-steel/30 bg-white shadow-sm">
      <div className="border-t-2 border-signara-gold px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-signara-navy">Pending template requests</h3>
            <p className="mt-0.5 text-sm text-signara-steel">
              Seniors and supervisors asking you to digitise a physical form
            </p>
          </div>
          <Badge className="bg-signara-gold text-signara-navy">{requests.length}</Badge>
        </div>
      </div>
      <ul className="divide-y divide-signara-steel/10">
        {requests.map((request) => (
          <TemplateRequestRow key={request.id} request={request} />
        ))}
      </ul>
    </div>
  )
}

function TemplateRequestRow({ request }: { request: TemplateRequestListItem }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isOpening, setIsOpening] = useState(false)

  async function handleViewAttachment() {
    setIsOpening(true)
    setError(null)
    const result = await getTemplateRequestAttachmentSignedUrl(request.attachment_path)
    setIsOpening(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  function handleDismiss() {
    setError(null)
    startTransition(async () => {
      const result = await dismissTemplateRequest({ requestId: request.id })
      if ('error' in result) {
        setError(result.error)
        return
      }
      toast.success('Request declined')
      router.refresh()
    })
  }

  function handleFulfill() {
    setError(null)
    startTransition(async () => {
      const result = await fulfillTemplateRequest({ requestId: request.id })
      if ('error' in result) {
        setError(result.error)
        return
      }
      toast.success('Marked as fulfilled')
      router.refresh()
    })
  }

  return (
    <li className="px-6 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-signara-navy">{request.title}</p>
          <p className="text-xs text-signara-steel">
            {request.requesterName}
            {request.requesterJobLevel ? ` · ${JOB_LEVEL_LABELS[request.requesterJobLevel]}` : ''}
            {' · '}
            {request.departmentName}
            {' · '}
            {new Date(request.created_at).toLocaleDateString('en-GB')}
          </p>
          {request.description && (
            <p className="text-sm text-signara-navy/80">{request.description}</p>
          )}
          <button
            type="button"
            onClick={handleViewAttachment}
            disabled={isOpening}
            className="inline-flex items-center gap-1.5 text-sm text-signara-gold hover:underline"
          >
            {isOpening ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <FileText className="size-3.5" />
            )}
            {request.attachment_filename}
            <ExternalLink className="size-3" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="signara"
            size="sm"
            asChild
            disabled={isPending}
          >
            <Link href={`/dashboard/templates/new?fromRequest=${request.id}`}>
              Create template
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleFulfill}
            disabled={isPending}
            className="border-signara-navy text-signara-navy"
          >
            {isPending ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1 size-3.5" />
            )}
            Mark done
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDismiss}
            disabled={isPending}
            className="border-destructive text-destructive hover:bg-destructive hover:text-white"
          >
            <XCircle className="mr-1 size-3.5" />
            Decline
          </Button>
        </div>
      </div>
      {error && (
        <div className="mt-2">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}
    </li>
  )
}
