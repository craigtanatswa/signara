'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DocumentPdfButtonProps {
  documentId: string
  /** Completed docs get "Download PDF"; in-progress get "Preview PDF". */
  mode: 'download' | 'preview'
  /**
   * Force a file download (Content-Disposition: attachment) instead of opening
   * the PDF inline in a new tab.
   */
  forceDownload?: boolean
  className?: string
}

export function DocumentPdfButton({
  documentId,
  mode,
  forceDownload = false,
  className,
}: DocumentPdfButtonProps) {
  const [busy, setBusy] = useState(false)
  const saveAsFile = forceDownload || mode === 'download'
  const label = saveAsFile ? 'Download PDF' : 'Preview PDF'
  const href = forceDownload
    ? `/api/documents/${documentId}/pdf?download=1`
    : `/api/documents/${documentId}/pdf`

  async function handleClick() {
    // Only one generation at a time — unlock after the browser download/open starts.
    if (busy) return

    setBusy(true)
    try {
      const response = await fetch(href)
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `Failed to ${saveAsFile ? 'download' : 'open'} PDF.`)
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)

      if (saveAsFile) {
        const disposition = response.headers.get('Content-Disposition') ?? ''
        const match = /filename="([^"]+)"/.exec(disposition)
        const filename = match?.[1] ?? 'document.pdf'
        const anchor = document.createElement('a')
        anchor.href = objectUrl
        anchor.download = filename
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        // Download has started — allow another click after cleanup.
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
      } else {
        const opened = window.open(objectUrl, '_blank', 'noopener,noreferrer')
        if (!opened) {
          URL.revokeObjectURL(objectUrl)
          throw new Error('Pop-up blocked. Allow pop-ups to preview the PDF.')
        }
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not prepare the PDF.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={() => void handleClick()}
      className={cn(
        forceDownload &&
          'border-signara-navy text-signara-navy hover:bg-signara-navy hover:text-white',
        className
      )}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      {busy ? 'Preparing PDF…' : label}
    </Button>
  )
}
