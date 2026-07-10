'use client'

import { useState } from 'react'
import { Eye, X } from 'lucide-react'
import { DocumentContentView } from '@/components/documents/document-content-view'
import { DocumentFilledFieldDisplay } from '@/components/documents/document-filled-field-display'
import { Button } from '@/components/ui/button'
import type { DocumentPreviewContext } from '@/lib/documents/build-preview-context'
import type { FormFieldAttrs, OrganisationBranding, TiptapDocument } from '@/types/database'

interface DocumentInstancePreviewProps {
  documentTitle: string
  templateName: string
  templateContent: TiptapDocument | null
  organisationBranding?: OrganisationBranding | null
  preview: DocumentPreviewContext
}

export function DocumentInstancePreview({
  documentTitle,
  templateName,
  templateContent,
  organisationBranding = null,
  preview,
}: DocumentInstancePreviewProps) {
  const [open, setOpen] = useState(false)

  if (!templateContent?.content?.length) {
    return null
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-signara-navy text-signara-navy hover:bg-signara-navy hover:text-white"
        onClick={() => setOpen(true)}
      >
        <Eye className="mr-1.5 size-4" />
        Preview document
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative flex max-h-[92vh] w-full max-w-[900px] flex-col overflow-hidden rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-signara-steel/20 px-5 py-3">
              <div>
                <p className="font-semibold text-signara-navy">{documentTitle}</p>
                <p className="text-xs text-signara-steel">
                  {templateName} — filled fields and signatures as they appear on the document
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                className="text-signara-steel"
              >
                <X className="mr-1 size-4" />
                Close
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-[#dde1e6] p-4">
              <DocumentContentView
                content={templateContent}
                organisationBranding={organisationBranding}
                className="overflow-x-auto py-2"
                renderField={(attrs: FormFieldAttrs) => (
                  <DocumentFilledFieldDisplay
                    attrs={attrs}
                    value={preview.fieldValues[attrs.fieldId]}
                    signatureDataUrl={preview.signaturesByFieldId[attrs.fieldId]}
                    fileUrl={preview.fileUrlsByFieldId[attrs.fieldId]}
                  />
                )}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
