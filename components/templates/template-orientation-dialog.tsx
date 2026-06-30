'use client'

import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatPageOrientationLabel } from '@/lib/tiptap/page-size'
import type { PageOrientation } from '@/types/database'

interface TemplateOrientationDialogProps {
  open: boolean
  currentOrientation: PageOrientation
  nextOrientation: PageOrientation | null
  onConfirm: () => void
  onCancel: () => void
}

function getOrientationCopy(orientation: PageOrientation) {
  if (orientation === 'landscape') {
    return {
      pageShape:
        'The page becomes wider and shorter — like turning a sheet of paper on its side.',
      layoutNote:
        'Lines may break in different places, so paragraphs can move up or down and content may jump between pages.',
      letterheadNote:
        'If you use a letterhead, upload a landscape version in Organisation settings or it may not appear.',
    }
  }

  return {
    pageShape:
      'The page becomes taller and narrower — like a standard printed letter.',
    layoutNote:
      'Lines may break in different places, so paragraphs can move up or down and content may jump between pages.',
    letterheadNote:
      'If you use a letterhead, the portrait version from Organisation settings will be used.',
  }
}

export function TemplateOrientationDialog({
  open,
  currentOrientation,
  nextOrientation,
  onConfirm,
  onCancel,
}: TemplateOrientationDialogProps) {
  if (!nextOrientation) return null

  const label = formatPageOrientationLabel(nextOrientation)
  const copy = getOrientationCopy(nextOrientation)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <DialogContent className="gap-0 overflow-hidden border-signara-steel/30 p-0 sm:max-w-md">
        <div className="border-t-2 border-t-signara-gold px-6 pt-6">
          <DialogHeader>
            <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-signara-navy/10">
              <FileText className="size-5 text-signara-navy" aria-hidden />
            </div>
            <DialogTitle className="text-signara-navy">Switch to {label.toLowerCase()}?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-left text-sm text-signara-steel">
                <p>
                  <span className="font-medium text-signara-navy">Your text and fields are kept.</span>{' '}
                  Nothing you have written is deleted.
                </p>
                <ul className="list-disc space-y-1.5 pl-5">
                  <li>{copy.pageShape}</li>
                  <li>{copy.layoutNote}</li>
                  <li>{copy.letterheadNote}</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
        </div>

        <DialogFooter className="gap-2 border-t border-signara-steel/20 bg-signara-background/40 px-6 py-4 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="border-signara-navy text-signara-navy hover:bg-signara-navy hover:text-white"
            onClick={onCancel}
          >
            Keep {formatPageOrientationLabel(currentOrientation).toLowerCase()}
          </Button>
          <Button
            type="button"
            className="bg-signara-gold font-semibold text-signara-navy hover:bg-[#C49B2E]"
            onClick={onConfirm}
          >
            Switch to {label.toLowerCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
