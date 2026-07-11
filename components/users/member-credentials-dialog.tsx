'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface MemberCredentials {
  fullName: string
  email: string
  tempPassword: string
}

interface MemberCredentialsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  credentials: MemberCredentials | null
  title?: string
  description?: string
}

export function MemberCredentialsDialog({
  open,
  onOpenChange,
  credentials,
  title = 'Login credentials',
  description,
}: MemberCredentialsDialogProps) {
  const [copiedField, setCopiedField] = useState<'email' | 'password' | 'all' | null>(null)

  async function copyToClipboard(value: string, field: 'email' | 'password' | 'all') {
    await navigator.clipboard.writeText(value)
    setCopiedField(field)
    window.setTimeout(() => setCopiedField(null), 2000)
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setCopiedField(null)
    }
    onOpenChange(isOpen)
  }

  const resolvedDescription =
    description ??
    (credentials
      ? `Save these login details for ${credentials.fullName}. They will not be shown again.`
      : '')

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-signara-navy">{title}</DialogTitle>
          <DialogDescription className="text-signara-steel">{resolvedDescription}</DialogDescription>
        </DialogHeader>

        {credentials && (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="font-medium text-signara-navy">Email</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={credentials.email}
                  className="border-signara-steel bg-signara-background font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 border-signara-navy text-signara-navy hover:bg-signara-navy hover:text-white"
                  onClick={() => copyToClipboard(credentials.email, 'email')}
                  aria-label="Copy email"
                >
                  {copiedField === 'email' ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-medium text-signara-navy">Temporary password</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={credentials.tempPassword}
                  className="border-signara-steel bg-signara-background font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 border-signara-navy text-signara-navy hover:bg-signara-navy hover:text-white"
                  onClick={() => copyToClipboard(credentials.tempPassword, 'password')}
                  aria-label="Copy password"
                >
                  {copiedField === 'password' ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full border-signara-navy text-signara-navy hover:bg-signara-navy hover:text-white"
              onClick={() =>
                copyToClipboard(
                  `Email: ${credentials.email}\nPassword: ${credentials.tempPassword}`,
                  'all'
                )
              }
            >
              {copiedField === 'all' ? (
                <>
                  <Check className="mr-2 size-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-2 size-4" />
                  Copy all login details
                </>
              )}
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="signara" onClick={() => handleOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
