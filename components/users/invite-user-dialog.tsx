'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const inviteSchema = z.object({
  full_name: z.string().min(2, { message: 'Full name must be at least 2 characters' }),
  email: z.string().email({ message: 'Please enter a valid email address' }),
  role: z.enum(['admin', 'member'], { message: 'Please select a role' }),
  department: z.string().optional(),
})

type InviteFormValues = z.infer<typeof inviteSchema>

interface InviteUserDialogProps {
  onSuccess: () => void
}

export function InviteUserDialog({ onSuccess }: InviteUserDialogProps) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'member' },
  })

  async function onSubmit(values: InviteFormValues) {
    setServerError(null)

    const response = await fetch('/api/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })

    const data = await response.json()

    if (!response.ok) {
      setServerError(data.error ?? 'Something went wrong. Please try again.')
      return
    }

    toast.success(`Invitation sent to ${values.email}`)
    reset()
    setOpen(false)
    onSuccess()
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      reset()
      setServerError(null)
    }
    setOpen(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="signara">
          <UserPlus className="mr-2 size-4" />
          Invite member
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-signara-navy">Invite team member</DialogTitle>
          <DialogDescription className="text-signara-steel">
            Send an invitation with a temporary password. They&apos;ll be prompted to set a new password on first login.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Full name */}
          <div className="space-y-1.5">
            <Label htmlFor="full_name" className="text-signara-navy font-medium">
              Full name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="full_name"
              placeholder="Jane Smith"
              {...register('full_name')}
              aria-invalid={!!errors.full_name}
              className="border-signara-steel focus-visible:ring-signara-navy"
            />
            {errors.full_name && (
              <p className="text-destructive text-xs">{errors.full_name.message}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="invite_email" className="text-signara-navy font-medium">
              Email address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="invite_email"
              type="email"
              placeholder="jane@company.com"
              {...register('email')}
              aria-invalid={!!errors.email}
              className="border-signara-steel focus-visible:ring-signara-navy"
            />
            {errors.email && (
              <p className="text-destructive text-xs">{errors.email.message}</p>
            )}
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label className="text-signara-navy font-medium">
              Role <span className="text-destructive">*</span>
            </Label>
            <Select
              defaultValue="member"
              onValueChange={(value) => setValue('role', value as 'admin' | 'member')}
            >
              <SelectTrigger className="border-signara-steel focus:ring-signara-navy">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-destructive text-xs">{errors.role.message}</p>
            )}
          </div>

          {/* Department */}
          <div className="space-y-1.5">
            <Label htmlFor="department" className="text-signara-navy font-medium">
              Department <span className="text-signara-steel font-normal">(optional)</span>
            </Label>
            <Input
              id="department"
              placeholder="e.g. Finance, HR, Operations"
              {...register('department')}
              className="border-signara-steel focus-visible:ring-signara-navy"
            />
          </div>

          {/* Server error */}
          {serverError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
              <p className="text-destructive text-sm">{serverError}</p>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="border-signara-navy text-signara-navy hover:bg-signara-navy hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              variant="signara"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Sending…
                </>
              ) : (
                'Send invitation'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
