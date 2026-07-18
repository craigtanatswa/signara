'use client'

import { useState, useTransition } from 'react'
import { Loader2, UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import { activateMember } from '@/app/actions/team'
import { ErrorMessage } from '@/components/ui/error-message'
import { ActionIconTooltip } from '@/components/ui/action-icon-tooltip'
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

interface ActivateMemberDialogProps {
  member: UserWithDepartment
  onSuccess: () => void
}

export function ActivateMemberDialog({ member, onSuccess }: ActivateMemberDialogProps) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!member.must_change_password) {
    return null
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setServerError(null)
    }
    setOpen(isOpen)
  }

  function handleActivate() {
    setServerError(null)

    startTransition(async () => {
      const result = await activateMember(member.id)

      if (result.error) {
        setServerError(result.error)
        return
      }

      toast.success(`${result.memberName ?? member.full_name} is now active`)
      setOpen(false)
      onSuccess()
    })
  }

  return (
    <>
      <ActionIconTooltip label="Activate account">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-signara-steel hover:text-signara-gold"
          onClick={() => handleOpenChange(true)}
          aria-label={`Activate ${member.full_name}`}
        >
          <UserCheck className="size-4" />
        </Button>
      </ActionIconTooltip>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-signara-navy">Activate account?</DialogTitle>
            <DialogDescription className="text-signara-steel">
              <span className="font-medium text-signara-navy">{member.full_name}</span> has not
              finished account setup. Activating marks them as active so they can be assigned as an
              approver and access the dashboard with their current password.
            </DialogDescription>
          </DialogHeader>

          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            If they cannot sign in, use Reset password to generate new login credentials.
          </p>

          {serverError && <ErrorMessage>{serverError}</ErrorMessage>}

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="signara" onClick={handleActivate} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Activating…
                </>
              ) : (
                'Activate account'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
