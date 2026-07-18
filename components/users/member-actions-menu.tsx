'use client'

import { useState, useTransition } from 'react'
import { Check, Copy, Loader2, Mail, MoreHorizontal, Shield, UserCheck, UserX } from 'lucide-react'
import { toast } from 'sonner'
import {
  changeMemberRole,
  resendInvitation,
  setMemberActive,
} from '@/app/actions/team'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { UserWithDepartment } from '@/types/database'

interface MemberActionsMenuProps {
  member: UserWithDepartment
  currentUserId: string
  onSuccess: () => void
}

export function MemberActionsMenu({
  member,
  currentUserId,
  onSuccess,
}: MemberActionsMenuProps) {
  const [isPending, startTransition] = useTransition()
  const [credentials, setCredentials] = useState<{
    email: string
    tempPassword: string
    memberName: string
  } | null>(null)
  const [copiedField, setCopiedField] = useState<'email' | 'password' | 'all' | null>(null)

  const isSelf = member.id === currentUserId
  const isActive = member.is_active !== false
  const canResendInvite = member.must_change_password && isActive

  function handleDeactivate() {
    startTransition(async () => {
      const result = await setMemberActive(member.id, false)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`${result.memberName ?? member.full_name} has been deactivated`)
      onSuccess()
    })
  }

  function handleReactivate() {
    startTransition(async () => {
      const result = await setMemberActive(member.id, true)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`${result.memberName ?? member.full_name} has been reactivated`)
      onSuccess()
    })
  }

  function handleChangeRole(role: 'admin' | 'member') {
    startTransition(async () => {
      const result = await changeMemberRole(member.id, role)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(
        `${result.memberName ?? member.full_name} is now a${role === 'admin' ? 'n admin' : ' member'}`
      )
      onSuccess()
    })
  }

  function handleResendInvitation() {
    startTransition(async () => {
      const result = await resendInvitation(member.id)
      if ('error' in result) {
        toast.error(result.error)
        return
      }

      if (result.delivery === 'manual') {
        setCredentials({
          email: result.email,
          tempPassword: result.tempPassword,
          memberName: result.memberName,
        })
      } else {
        toast.success(`Invitation resent to ${result.email}`)
      }
      onSuccess()
    })
  }

  async function copyToClipboard(text: string, field: 'email' | 'password' | 'all') {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-signara-steel hover:text-signara-navy"
            aria-label={`More actions for ${member.full_name}`}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MoreHorizontal className="size-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {canResendInvite && (
            <DropdownMenuItem onClick={handleResendInvitation}>
              <Mail className="size-4" />
              Resend invitation
            </DropdownMenuItem>
          )}

          {member.role === 'member' && (
            <DropdownMenuItem onClick={() => handleChangeRole('admin')}>
              <Shield className="size-4" />
              Promote to admin
            </DropdownMenuItem>
          )}

          {member.role === 'admin' && (
            <DropdownMenuItem onClick={() => handleChangeRole('member')}>
              <Shield className="size-4" />
              Demote to member
            </DropdownMenuItem>
          )}

          {!isSelf && (
            <>
              {(canResendInvite || member.role === 'admin' || member.role === 'member') && (
                <DropdownMenuSeparator />
              )}
              {isActive ? (
                <DropdownMenuItem
                  onClick={handleDeactivate}
                  className="text-destructive focus:text-destructive"
                >
                  <UserX className="size-4" />
                  Deactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={handleReactivate}>
                  <UserCheck className="size-4" />
                  Reactivate
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={!!credentials}
        onOpenChange={(open) => {
          if (!open) {
            setCredentials(null)
            setCopiedField(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-signara-navy">New invitation credentials</DialogTitle>
            <DialogDescription className="text-signara-steel">
              Share these with {credentials?.memberName}. The previous temporary password no longer
              works.
            </DialogDescription>
          </DialogHeader>
          {credentials && (
            <div className="space-y-3">
              <CredentialRow
                label="Email"
                value={credentials.email}
                copied={copiedField === 'email'}
                onCopy={() => copyToClipboard(credentials.email, 'email')}
              />
              <CredentialRow
                label="Temporary password"
                value={credentials.tempPassword}
                copied={copiedField === 'password'}
                onCopy={() => copyToClipboard(credentials.tempPassword, 'password')}
              />
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!credentials) return
                void copyToClipboard(
                  `Email: ${credentials.email}\nPassword: ${credentials.tempPassword}`,
                  'all'
                )
              }}
            >
              {copiedField === 'all' ? (
                <Check className="mr-2 size-4" />
              ) : (
                <Copy className="mr-2 size-4" />
              )}
              Copy all
            </Button>
            <Button type="button" variant="signara" onClick={() => setCredentials(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function CredentialRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string
  value: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-signara-steel/30 bg-signara-background px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-signara-steel">{label}</p>
        <p className="truncate font-mono text-sm text-signara-navy">{value}</p>
      </div>
      <Button type="button" variant="ghost" size="icon" onClick={onCopy} aria-label={`Copy ${label}`}>
        {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
      </Button>
    </div>
  )
}
