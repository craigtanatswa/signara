import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DocumentPdfButtonProps {
  documentId: string
  /** Completed docs get "Download PDF"; in-progress get "Preview PDF". */
  mode: 'download' | 'preview'
}

export function DocumentPdfButton({ documentId, mode }: DocumentPdfButtonProps) {
  const label = mode === 'download' ? 'Download PDF' : 'Preview PDF'
  const href = `/api/documents/${documentId}/pdf`

  return (
    <Button variant="outline" size="sm" asChild>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <Download className="size-4" />
        {label}
      </a>
    </Button>
  )
}
