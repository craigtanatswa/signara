'use client'

import { useState } from 'react'
import { Eye, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { getDocumentAttachmentSignedUrl } from '@/app/actions/documents'
import { DocumentContentView } from '@/components/documents/document-content-view'
import { DocumentFilledFieldDisplay } from '@/components/documents/document-filled-field-display'
import { DocumentPdfButton } from '@/components/documents/document-pdf-button'
import { Button } from '@/components/ui/button'
import type { DocumentPreviewContext } from '@/lib/documents/build-preview-context'
import type { FormFieldAttrs, OrganisationBranding, TiptapDocument } from '@/types/database'

interface DocumentInstancePreviewProps {
  documentId: string
  documentTitle: string
  templateName: string
  templateContent: TiptapDocument | null
  organisationBranding?: OrganisationBranding | null
  preview: DocumentPreviewContext
  /**
   * Storage path of the physically signed upload. When set, Preview opens that
   * file (the real approved document) instead of the digital reconstruction.
   */
  physicalSignaturePath?: string | null
}

export function DocumentInstancePreview({
  documentId,
  documentTitle,
  templateName,
  templateContent,
  organisationBranding = null,
  preview,
  physicalSignaturePath = null,
}: DocumentInstancePreviewProps) {
  const [open, setOpen] = useState(false)
  const [openingScan, setOpeningScan] = useState(false)

  if (!templateContent?.content?.length && !physicalSignaturePath) {
    return null
  }

  async function openApprovedDocument() {
    if (!physicalSignaturePath || openingScan) return

    setOpeningScan(true)
    try {
      const result = await getDocumentAttachmentSignedUrl(physicalSignaturePath)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      const opened = window.open(result.url, '_blank', 'noopener,noreferrer')
      if (!opened) {
        toast.error('Pop-up blocked. Allow pop-ups to view the approved document.')
      }
    } catch {
      toast.error('Could not open the approved document.')
    } finally {
      setOpeningScan(false)
    }
  }

  function handlePreviewClick() {
    if (physicalSignaturePath) {
      void openApprovedDocument()
      return
    }
    setOpen(true)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={openingScan}
        className="border-signara-navy text-signara-navy hover:bg-signara-navy hover:text-white"
        onClick={handlePreviewClick}
      >
        {openingScan ? (
          <Loader2 className="mr-1.5 size-4 animate-spin" />
        ) : (
          <Eye className="mr-1.5 size-4" />
        )}
        {openingScan ? 'Opening…' : 'Preview document'}
      </Button>

      {open && templateContent?.content?.length ? (
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
              <div className="flex flex-wrap items-center gap-2">
                <DocumentPdfButton documentId={documentId} mode="download" forceDownload />
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
                    physicallySigned={Boolean(preview.physicalByFieldId[attrs.fieldId])}
                    fileUrl={preview.fileUrlsByFieldId[attrs.fieldId]}
                  />
                )}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
