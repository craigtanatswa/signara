'use client'

import { useState, useTransition } from 'react'
import { KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { resetMemberPassword } from '@/app/actions/team'
import { isTestUserEmail } from '@/lib/users/test-user'
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
import {
  MemberCredentialsDialog,
  type MemberCredentials,
} from '@/components/users/member-credentials-dialog'
import type { UserWithDepartment } from '@/types/database'

interface ResetPasswordDialogProps {
  member: UserWithDepartment
  currentUserId: string
  onSuccess: () => void
}

export function ResetPasswordDialog({
  member,
  currentUserId,
  onSuccess,
}: ResetPasswordDialogProps) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [credentialsOpen, setCredentialsOpen] = useState(false)
  const [createdCredentials, setCreatedCredentials] = useState<MemberCredentials | null>(null)

  const isSelf = member.id === currentUserId
  const isTestUser = isTestUserEmail(member.email)

  if (isSelf) {
    return null
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setServerError(null)
    }
    setOpen(isOpen)
  }

  function handleReset() {
    setServerError(null)

    startTransition(async () => {
      const result = await resetMemberPassword(member.id)

      if ('error' in result) {
        setServerError(result.error)
        return
      }

      setOpen(false)
      onSuccess()

      if (result.delivery === 'manual') {
        setCreatedCredentials({
          fullName: result.memberName,
          email: result.email,
          tempPassword: result.tempPassword,
        })
        setCredentialsOpen(true)
        return
      }

      toast.success(`New password emailed to ${result.email}`)
    })
  }

  function handleCredentialsClose() {
    setCredentialsOpen(false)
    setCreatedCredentials(null)
  }

  return (
    <>
      <ActionIconTooltip label="Reset password">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-signara-steel hover:text-signara-navy"
          onClick={() => handleOpenChange(true)}
          aria-label={`Reset password for ${member.full_name}`}
        >
          <KeyRound className="size-4" />
        </Button>
      </ActionIconTooltip>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-signara-navy">Reset password?</DialogTitle>
            <DialogDescription className="text-signara-steel">
              Generate a new temporary password for{' '}
              <span className="font-medium text-signara-navy">{member.full_name}</span> (
              {member.email}). They will be asked to create a new password when they next sign in.
            </DialogDescription>
          </DialogHeader>

          <p className="rounded-md border border-signara-steel/20 bg-signara-background px-3 py-2 text-xs text-signara-steel">
            {isTestUser
              ? 'This is a test user — the new password will be shown here after reset.'
              : 'The new password will be emailed to this user.'}
          </p>

          {serverError && <ErrorMessage>{serverError}</ErrorMessage>}

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="signara" onClick={handleReset} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Resetting…
                </>
              ) : (
                'Reset password'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MemberCredentialsDialog
        open={credentialsOpen}
        onOpenChange={(isOpen) => !isOpen && handleCredentialsClose()}
        credentials={createdCredentials}
        title="New login credentials"
        description={
          createdCredentials
            ? `Save these login details for ${createdCredentials.fullName}. They will not be shown again.`
            : undefined
        }
      />
    </>
  )
}
