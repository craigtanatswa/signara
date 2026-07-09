'use client'

import { useState, useTransition } from 'react'
import { Loader2, UserMinus } from 'lucide-react'
import { toast } from 'sonner'
import { removeMember } from '@/app/actions/team'
import { ErrorMessage } from '@/components/ui/error-message'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { UserWithDepartment } from '@/types/database'

interface RemoveMemberDialogProps {
  member: UserWithDepartment
  currentUserId: string
  onSuccess: () => void
}

export function RemoveMemberDialog({
  member,
  currentUserId,
  onSuccess,
}: RemoveMemberDialogProps) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isSelf = member.id === currentUserId
  const isManagingDirector = member.job_level === 'managing_director'

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setServerError(null)
    }
    setOpen(isOpen)
  }

  function handleRemove() {
    setServerError(null)

    startTransition(async () => {
      const result = await removeMember(member.id)

      if (result.error) {
        setServerError(result.error)
        return
      }

      toast.success(`${result.removedName ?? member.full_name} was removed from your organisation`)
      setOpen(false)
      onSuccess()
    })
  }

  if (isSelf) {
    return null
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-signara-steel hover:text-destructive"
        onClick={() => handleOpenChange(true)}
        aria-label={`Remove ${member.full_name}`}
      >
        <UserMinus className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-signara-navy">Remove team member?</DialogTitle>
            <DialogDescription className="text-signara-steel">
              <span className="font-medium text-signara-navy">{member.full_name}</span> (
              {member.email}) will lose access to Signara. Their login will be deleted.
            </DialogDescription>
          </DialogHeader>

          {isManagingDirector && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              This person is your Managing Director. Removing them will leave the organisation
              without an MD until you assign the role to someone else.
            </p>
          )}

          {serverError && <ErrorMessage>{serverError}</ErrorMessage>}

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Removing…
                </>
              ) : (
                'Remove member'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
