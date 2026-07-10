'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ExternalLink, FileText, Inbox, Loader2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  dismissTemplateRequest,
  fulfillTemplateRequest,
  getTemplateRequestAttachmentSignedUrl,
  type TemplateRequestListItem,
} from '@/app/actions/template-requests'
import { TemplateRequestStatusBadge } from '@/components/templates/template-request-status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/error-message'
import { cn } from '@/lib/utils'
import { JOB_LEVEL_LABELS } from '@/types/org-structure'
import type { TemplateRequestStatus } from '@/types/database'

type StatusFilter = 'all' | TemplateRequestStatus

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'fulfilled', label: 'Satisfied' },
  { value: 'dismissed', label: 'Declined' },
]

interface AdminRequestsClientProps {
  requests: TemplateRequestListItem[]
}

export function AdminRequestsClient({ requests }: AdminRequestsClientProps) {
  const [filter, setFilter] = useState<StatusFilter>('pending')

  const counts = useMemo(() => {
    const next = { all: requests.length, pending: 0, fulfilled: 0, dismissed: 0 }
    for (const request of requests) {
      next[request.status] += 1
    }
    return next
  }, [requests])

  const filtered = useMemo(
    () => (filter === 'all' ? requests : requests.filter((r) => r.status === filter)),
    [filter, requests]
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-signara-navy">Template requests</h2>
        <p className="mt-0.5 text-sm text-signara-steel">
          Review digitisation requests from seniors and supervisors. Mark them satisfied when a
          template is ready, or decline if not needed.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
              filter === item.value
                ? 'border-signara-navy bg-signara-navy text-white'
                : 'border-signara-steel/40 bg-white text-signara-navy hover:border-signara-navy/40'
            )}
          >
            {item.label}
            <Badge
              className={cn(
                'h-5 min-w-5 justify-center px-1.5 text-[10px]',
                filter === item.value
                  ? 'bg-signara-gold text-signara-navy'
                  : 'bg-signara-background text-signara-steel'
              )}
            >
              {counts[item.value]}
            </Badge>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-signara-steel/40 bg-white py-16 text-center">
          <Inbox className="size-12 text-signara-steel/30" />
          <p className="mt-4 font-medium text-signara-navy">
            {filter === 'pending' ? 'No pending requests' : 'No requests in this view'}
          </p>
          <p className="mt-1 max-w-sm text-sm text-signara-steel">
            {filter === 'pending'
              ? 'You will be notified when a team member submits a new template request.'
              : 'Try another status filter.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-signara-steel/10 overflow-hidden rounded-lg border border-signara-steel/30 bg-white shadow-sm">
          {filtered.map((request) => (
            <AdminRequestRow key={request.id} request={request} />
          ))}
        </ul>
      )}
    </div>
  )
}

function AdminRequestRow({ request }: { request: TemplateRequestListItem }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isOpening, setIsOpening] = useState(false)
  const isOpen = request.status === 'pending'

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
      toast.success('Request marked as satisfied')
      router.refresh()
    })
  }

  return (
    <li className="px-6 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-signara-navy">{request.title}</p>
            <TemplateRequestStatusBadge status={request.status} />
          </div>
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
          {request.admin_notes && (
            <p className="text-sm text-signara-steel">
              <span className="font-medium text-signara-navy">Note:</span> {request.admin_notes}
            </p>
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

        {isOpen && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="signara" size="sm" asChild disabled={isPending}>
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
              Mark satisfied
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
        )}
      </div>
      {error && (
        <div className="mt-2">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}
    </li>
  )
}
