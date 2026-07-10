'use client'

import { useState } from 'react'
import { ExternalLink, FileText, Inbox, Loader2 } from 'lucide-react'
import {
  getTemplateRequestAttachmentSignedUrl,
  type TemplateRequestListItem,
} from '@/app/actions/template-requests'
import { RequestTemplateDialog } from '@/components/templates/request-template-dialog'
import { TemplateRequestStatusBadge } from '@/components/templates/template-request-status-badge'
import { ErrorMessage } from '@/components/ui/error-message'
import type { DepartmentOption } from '@/types/org-structure'

interface MyRequestsClientProps {
  requests: TemplateRequestListItem[]
  canRequest: boolean
  departments: DepartmentOption[]
  defaultDepartmentId: string | null
}

export function MyRequestsClient({
  requests,
  canRequest,
  departments,
  defaultDepartmentId,
}: MyRequestsClientProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-signara-navy">My requests</h2>
          <p className="mt-0.5 text-sm text-signara-steel">
            Ask an administrator to digitise a physical form. Track pending and satisfied
            requests here.
          </p>
        </div>
        {canRequest && departments.length > 0 && (
          <RequestTemplateDialog
            departments={departments}
            defaultDepartmentId={defaultDepartmentId}
          />
        )}
      </div>

      {!canRequest && (
        <p className="rounded-md border border-signara-steel/30 bg-white px-4 py-3 text-sm text-signara-steel shadow-sm">
          Only seniors and above can submit template requests. Ask a senior or supervisor in
          your department if you need a form digitised.
        </p>
      )}

      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-signara-steel/40 bg-white py-16 text-center">
          <Inbox className="size-12 text-signara-steel/30" />
          <p className="mt-4 font-medium text-signara-navy">No requests yet</p>
          <p className="mt-1 max-w-sm text-sm text-signara-steel">
            {canRequest
              ? 'Upload a scan of a paper form to request a department template.'
              : 'When a senior submits a request on your behalf, it will appear here.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-signara-steel/10 overflow-hidden rounded-lg border border-signara-steel/30 bg-white shadow-sm">
          {requests.map((request) => (
            <MyRequestRow key={request.id} request={request} />
          ))}
        </ul>
      )}
    </div>
  )
}

function MyRequestRow({ request }: { request: TemplateRequestListItem }) {
  const [error, setError] = useState<string | null>(null)
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

  return (
    <li className="px-6 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-signara-navy">{request.title}</p>
            <TemplateRequestStatusBadge status={request.status} />
          </div>
          <p className="text-xs text-signara-steel">
            {request.departmentName}
            {' · '}
            Submitted {new Date(request.created_at).toLocaleDateString('en-GB')}
            {request.reviewed_at
              ? ` · Reviewed ${new Date(request.reviewed_at).toLocaleDateString('en-GB')}`
              : ''}
          </p>
          {request.description && (
            <p className="text-sm text-signara-navy/80">{request.description}</p>
          )}
          {request.admin_notes && (
            <p className="text-sm text-signara-steel">
              <span className="font-medium text-signara-navy">Admin note:</span>{' '}
              {request.admin_notes}
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
      </div>
      {error && (
        <div className="mt-2">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}
    </li>
  )
}
