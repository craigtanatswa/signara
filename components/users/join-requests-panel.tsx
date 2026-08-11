'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'
import {
  cancelPendingInvite,
  resendPendingInvite,
  reviewJoinRequest,
} from '@/app/actions/join-admin'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { OrganisationInvite, OrganisationJoinRequest } from '@/types/database'

interface JoinRequestsPanelProps {
  pendingInvites: OrganisationInvite[]
  joinRequests: OrganisationJoinRequest[]
}

export function JoinRequestsPanel({ pendingInvites, joinRequests }: JoinRequestsPanelProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [copiedId, setCopiedId] = useState<string | null>(null)

  function refresh() {
    router.refresh()
  }

  function approve(id: string) {
    startTransition(async () => {
      const result = await reviewJoinRequest({ requestId: id, decision: 'approved' })
      if (result.error) toast.error(result.error)
      else {
        toast.success('Applicant approved')
        refresh()
      }
    })
  }

  function reject(id: string) {
    startTransition(async () => {
      const result = await reviewJoinRequest({ requestId: id, decision: 'rejected' })
      if (result.error) toast.error(result.error)
      else {
        toast.success('Applicant rejected')
        refresh()
      }
    })
  }

  function resend(id: string) {
    startTransition(async () => {
      const result = await resendPendingInvite(id)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      if (result.delivery === 'manual') {
        try {
          await navigator.clipboard.writeText(result.inviteUrl)
          toast.success('Invite link copied to clipboard')
        } catch {
          toast.success(`Invite ready: ${result.inviteUrl}`)
        }
      } else {
        toast.success(`Invitation resent to ${result.email}`)
      }
      refresh()
    })
  }

  function cancel(id: string) {
    startTransition(async () => {
      const result = await cancelPendingInvite(id)
      if (result.error) toast.error(result.error)
      else {
        toast.success('Invitation cancelled')
        refresh()
      }
    })
  }

  async function copyInvite(invite: OrganisationInvite) {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/join/invite/${invite.token}`
        : `/join/invite/${invite.token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(invite.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error('Could not copy link')
    }
  }

  const pendingRequests = joinRequests.filter((r) => r.status === 'pending')
  const recentReviewed = joinRequests
    .filter((r) => r.status !== 'pending')
    .slice(0, 8)

  if (pendingInvites.length === 0 && joinRequests.length === 0) {
    return null
  }

  return (
    <div className="space-y-6">
      {pendingInvites.length > 0 && (
        <div className="rounded-lg border border-signara-steel/30 bg-white shadow-sm">
          <div className="border-b border-signara-steel/20 px-6 py-4">
            <h3 className="font-semibold text-signara-navy">Pending email invites</h3>
            <p className="mt-0.5 text-sm text-signara-steel">
              Waiting for the invitee to accept their link.
            </p>
          </div>
          <ul className="divide-y divide-signara-steel/20">
            {pendingInvites.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-signara-navy">{invite.full_name}</p>
                  <p className="text-sm text-signara-steel">{invite.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-signara-navy text-signara-navy"
                    disabled={pending}
                    onClick={() => copyInvite(invite)}
                  >
                    {copiedId === invite.id ? (
                      <Check className="mr-1 size-3.5" />
                    ) : (
                      <Copy className="mr-1 size-3.5" />
                    )}
                    Copy link
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-signara-navy text-signara-navy"
                    disabled={pending}
                    onClick={() => resend(invite.id)}
                  >
                    Resend
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={pending}
                    onClick={() => cancel(invite.id)}
                  >
                    Cancel
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(pendingRequests.length > 0 || recentReviewed.length > 0) && (
        <div className="rounded-lg border border-signara-steel/30 bg-white shadow-sm">
          <div className="border-b border-signara-steel/20 px-6 py-4">
            <h3 className="font-semibold text-signara-navy">Join requests</h3>
            <p className="mt-0.5 text-sm text-signara-steel">
              People who applied via your shareable join link.
            </p>
          </div>

          {pendingRequests.length === 0 ? (
            <p className="px-6 py-8 text-sm text-signara-steel">No pending requests.</p>
          ) : (
            <ul className="divide-y divide-signara-steel/20">
              {pendingRequests.map((request) => (
                <li
                  key={request.id}
                  className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-signara-navy">{request.full_name}</p>
                    <p className="text-sm text-signara-steel">{request.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="signara"
                      disabled={pending}
                      onClick={() => approve(request.id)}
                    >
                      {pending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Check className="mr-1 size-3.5" />
                      )}
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-destructive text-destructive"
                      disabled={pending}
                      onClick={() => reject(request.id)}
                    >
                      <X className="mr-1 size-3.5" />
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {recentReviewed.length > 0 && (
            <div className="border-t border-signara-steel/20 px-6 py-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-signara-steel">
                Recently reviewed
              </p>
              <ul className="space-y-2">
                {recentReviewed.map((request) => (
                  <li
                    key={request.id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-signara-navy">
                      {request.full_name}{' '}
                      <span className="text-signara-steel">({request.email})</span>
                    </span>
                    <Badge
                      variant="secondary"
                      className={
                        request.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-700'
                      }
                    >
                      {request.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
