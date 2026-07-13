'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Archive, Download, Loader2 } from 'lucide-react'
import { bulkArchiveDocuments } from '@/app/actions/documents'
import { Button } from '@/components/ui/button'

interface BulkActionsBarProps {
  selectedIds: string[]
  onClearSelection: () => void
}

/**
 * Admin bulk actions for the All-documents tab.
 *
 * Stretch: ZIP download of all selected PDFs is not implemented here —
 * download each document individually from its detail page for now.
 */
export function BulkActionsBar({ selectedIds, onClearSelection }: BulkActionsBarProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (selectedIds.length === 0) return null

  function handleArchive() {
    startTransition(async () => {
      const result = await bulkArchiveDocuments({ documentIds: selectedIds })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(
        result.archived === 1
          ? '1 document archived'
          : `${result.archived} documents archived`
      )
      onClearSelection()
      router.refresh()
    })
  }

  return (
    <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-signara-gold/40 bg-white px-4 py-3 shadow-md">
      <p className="text-sm font-medium text-signara-navy">
        {selectedIds.length} selected
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={onClearSelection} disabled={isPending}>
          Clear
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled
          title="Download all as ZIP — not yet available; download documents individually from their detail pages"
          className="border-signara-steel text-signara-steel"
        >
          <Download className="mr-1.5 size-4" />
          Download all as ZIP
        </Button>
        <Button type="button" variant="signara" onClick={handleArchive} disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" />
          ) : (
            <Archive className="mr-1.5 size-4" />
          )}
          Archive
        </Button>
      </div>
    </div>
  )
}
