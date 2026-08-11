'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Link2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  revokeOrganisationJoinLink,
  upsertOrganisationJoinLink,
} from '@/app/actions/join-admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { OrganisationJoinLink } from '@/types/database'

interface JoinLinkPanelProps {
  link: OrganisationJoinLink | null
}

export function JoinLinkPanel({ link }: JoinLinkPanelProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [limited, setLimited] = useState(link?.max_uses != null)
  const [maxUses, setMaxUses] = useState(String(link?.max_uses ?? 10))
  const [copied, setCopied] = useState(false)

  const joinUrl = useMemo(() => {
    if (!link) return ''
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/join/${link.token}`
    }
    return `/join/${link.token}`
  }, [link])

  function saveLink() {
    const value = limited ? Number(maxUses) : null
    if (limited && (!Number.isFinite(value) || (value as number) < 1)) {
      toast.error('Enter a limit of at least 1, or choose unlimited')
      return
    }
    startTransition(async () => {
      const result = await upsertOrganisationJoinLink({ maxUses: value })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(link ? 'Join link updated' : 'Join link created')
      router.refresh()
    })
  }

  function revoke() {
    startTransition(async () => {
      const result = await revokeOrganisationJoinLink()
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Join link revoked')
      router.refresh()
    })
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy link')
    }
  }

  const usageLabel = link
    ? link.max_uses == null
      ? `${link.approved_count} approved · unlimited`
      : `${link.approved_count} / ${link.max_uses} approved`
    : null

  return (
    <div className="rounded-lg border border-signara-steel/30 border-t-2 border-t-signara-gold bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-9 items-center justify-center rounded-full bg-signara-gold/15">
          <Link2 className="size-4 text-signara-gold" />
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h3 className="font-semibold text-signara-navy">Shareable join link</h3>
            <p className="mt-1 text-sm text-signara-steel">
              Anyone with the link can request to join. You approve or reject each request.
            </p>
          </div>

          {link && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={joinUrl}
                  className="border-signara-steel bg-signara-background font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 border-signara-navy text-signara-navy"
                  onClick={copyLink}
                  aria-label="Copy join link"
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
              {usageLabel && <p className="text-xs text-signara-steel">{usageLabel}</p>}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <Label className="text-signara-navy">Member limit</Label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-signara-navy">
                  <input
                    type="radio"
                    checked={!limited}
                    onChange={() => setLimited(false)}
                    className="accent-signara-gold"
                  />
                  Unlimited
                </label>
                <label className="flex items-center gap-2 text-sm text-signara-navy">
                  <input
                    type="radio"
                    checked={limited}
                    onChange={() => setLimited(true)}
                    className="accent-signara-gold"
                  />
                  Limited
                </label>
                {limited && (
                  <Input
                    type="number"
                    min={1}
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    className="h-9 w-24 border-signara-steel"
                  />
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="signara" disabled={pending} onClick={saveLink}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                {link ? 'Update link' : 'Create link'}
              </Button>
              {link && (
                <Button
                  type="button"
                  variant="outline"
                  className="border-signara-navy text-signara-navy"
                  disabled={pending}
                  onClick={revoke}
                >
                  Revoke
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
