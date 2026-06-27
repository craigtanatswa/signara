'use client'

import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface TemplateUnsavedDialogProps {
  open: boolean
  isSaving: boolean
  onSaveDraft: () => void
  onDiscard: () => void
  onCancel: () => void
}

export function TemplateUnsavedDialog({
  open,
  isSaving,
  onSaveDraft,
  onDiscard,
  onCancel,
}: TemplateUnsavedDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isSaving && onCancel()}>
      <DialogContent showCloseButton={!isSaving}>
        <DialogHeader>
          <DialogTitle>Save template as draft?</DialogTitle>
          <DialogDescription>
            You have unsaved changes. Save this template as a draft so you can finish it later, or
            leave without saving.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            Keep editing
          </Button>
          <Button variant="ghost" onClick={onDiscard} disabled={isSaving} className="text-signara-steel">
            Leave without saving
          </Button>
          <Button
            onClick={onSaveDraft}
            disabled={isSaving}
            className="bg-signara-gold text-signara-navy font-semibold hover:bg-[#C49B2E]"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving draft…
              </>
            ) : (
              'Save as draft'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
