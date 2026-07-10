'use client'

import dynamic from 'next/dynamic'
import { DocumentContentView } from '@/components/documents/document-content-view'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { OrganisationBranding, TiptapDocument } from '@/types/database'

const TemplatePdfDownloadButton = dynamic(
  () => import('@/lib/pdf/template-preview').then((m) => m.TemplatePdfDownloadButton),
  {
    ssr: false,
    loading: () => (
      <span
        className={cn(
          'inline-flex h-8 items-center justify-center rounded-md border-2 border-transparent',
          'bg-signara-gold/70 px-3 text-sm font-semibold text-signara-navy opacity-70'
        )}
      >
        Preparing PDF…
      </span>
    ),
  }
)

interface DocumentPreviewModalProps {
  content: TiptapDocument
  name: string
  organisationBranding?: OrganisationBranding | null
  onClose: () => void
}

/**
 * Shows admins the same branded document layout users see when filling in
 * details, with a Download PDF action that matches those field controls.
 */
export function DocumentPreviewModal({
  content,
  name,
  organisationBranding,
  onClose,
}: DocumentPreviewModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-[900px] flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-signara-steel/20 px-5 py-3">
          <div>
            <p className="font-semibold text-signara-navy">{name} — Document preview</p>
            <p className="text-xs text-signara-steel">
              How this template looks when someone starts a document
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TemplatePdfDownloadButton
              content={content}
              name={name || 'template'}
              organisationBranding={organisationBranding}
              className={cn(
                'inline-flex h-8 items-center justify-center gap-1.5 rounded-md border-2 border-transparent',
                'bg-signara-gold px-3 text-sm font-semibold text-signara-navy no-underline',
                'hover:border-signara-navy hover:bg-[#D4AF37]'
              )}
            />
            <Button variant="ghost" size="sm" onClick={onClose} className="text-signara-steel">
              Close
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#dde1e6] p-4">
          <DocumentContentView
            content={content}
            organisationBranding={organisationBranding}
            className="overflow-x-auto py-2"
          />
        </div>
      </div>
    </div>
  )
}
