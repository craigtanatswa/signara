import { Download } from 'lucide-react'
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
  const label = mode === 'download' || forceDownload ? 'Download PDF' : 'Preview PDF'
  const href = forceDownload
    ? `/api/documents/${documentId}/pdf?download=1`
    : `/api/documents/${documentId}/pdf`

  return (
    <Button
      variant="outline"
      size="sm"
      asChild
      className={cn(
        forceDownload &&
          'border-signara-navy text-signara-navy hover:bg-signara-navy hover:text-white',
        className
      )}
    >
      <a
        href={href}
        target={forceDownload ? undefined : '_blank'}
        rel="noopener noreferrer"
        download={forceDownload ? true : undefined}
      >
        <Download className="size-4" />
        {label}
      </a>
    </Button>
  )
}
