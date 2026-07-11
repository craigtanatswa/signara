'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Lock } from 'lucide-react'
import { updateProfile } from '@/app/actions/profile'
import { SuccessModal } from '@/components/ui/success-modal'
import { ErrorMessage } from '@/components/ui/error-message'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { JOB_LEVEL_LABELS } from '@/types/org-structure'
import type { User, Organisation, UserWithDepartment } from '@/types/database'

const profileSchema = z.object({
  full_name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
})

type ProfileFormValues = z.infer<typeof profileSchema>

interface ProfileInfoFormProps {
  user: UserWithDepartment
  organisation: Organisation
}

export function ProfileInfoForm({ user, organisation }: ProfileInfoFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [successOpen, setSuccessOpen] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: user.full_name,
    },
  })

  async function onSubmit(values: ProfileFormValues) {
    setServerError(null)
    const result = await updateProfile(values)

    if (!result.success) {
      setServerError(result.error)
      return
    }

    setSuccessOpen(true)
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Full name */}
      <div className="space-y-1.5">
        <Label htmlFor="full_name" className="text-signara-navy font-medium">
          Full name
        </Label>
        <Input
          id="full_name"
          {...register('full_name')}
          aria-invalid={!!errors.full_name}
          className="border-signara-steel focus-visible:ring-signara-navy"
        />
        {errors.full_name && (
          <p className="text-destructive text-xs">{errors.full_name.message}</p>
        )}
      </div>

      {/* Read-only: position */}
      <div className="space-y-1.5">
        <Label className="text-signara-navy font-medium">Position</Label>
        <div className="flex h-10 items-center">
          <span className="text-sm text-signara-navy">{user.position?.trim() || '—'}</span>
        </div>
      </div>

      {/* Read-only: department & job level */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-signara-navy font-medium">Department</Label>
          <div className="flex h-10 items-center">
            <span className="text-sm text-signara-navy">
              {user.departments?.name ?? user.department ?? '—'}
            </span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-signara-navy font-medium">Job level</Label>
          <div className="flex h-10 items-center">
            <Badge variant="outline" className="border-signara-navy/20 bg-signara-navy/5 text-signara-navy">
              {JOB_LEVEL_LABELS[user.job_level] ?? 'Staff'}
            </Badge>
          </div>
        </div>
      </div>
      <p className="text-xs text-signara-steel">
        Position, department, and job level are managed by your organisation admin.
      </p>

      {/* Read-only: email */}
      <div className="space-y-1.5">
        <Label className="text-signara-navy font-medium">Email address</Label>
        <div className="relative">
          <Input
            value={user.email}
            readOnly
            className="border-signara-steel bg-signara-background pr-9 text-signara-steel cursor-not-allowed"
          />
          <Lock className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-signara-steel/60" />
        </div>
        <p className="text-xs text-signara-steel">Email address cannot be changed here.</p>
      </div>

      {/* Read-only: role + org */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-signara-navy font-medium">Signara access</Label>
          <div className="flex h-10 items-center">
            <Badge
              className={
                user.role === 'admin'
                  ? 'bg-signara-navy/10 text-signara-navy border-signara-navy/20'
                  : 'bg-signara-steel/10 text-signara-steel border-signara-steel/20'
              }
              variant="outline"
            >
              {user.role === 'admin' ? 'Admin' : 'Member'}
            </Badge>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-signara-navy font-medium">Organisation</Label>
          <div className="flex h-10 items-center">
            <span className="text-sm text-signara-navy">{organisation.name}</span>
          </div>
        </div>
      </div>

      {serverError && <ErrorMessage>{serverError}</ErrorMessage>}

      <Button
        type="submit"
        disabled={isSubmitting || !isDirty}
        variant="signara"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Saving…
          </>
        ) : (
          'Save changes'
        )}
      </Button>
    </form>

      <SuccessModal
        open={successOpen}
        onOpenChange={setSuccessOpen}
        title="Profile updated"
        description="Your profile details have been saved successfully."
      />
    </>
  )
}
