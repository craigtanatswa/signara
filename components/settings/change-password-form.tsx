'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { updatePassword } from '@/app/actions/profile'
import { SuccessModal } from '@/components/ui/success-modal'
import { ErrorMessage } from '@/components/ui/error-message'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const passwordSchema = z
  .object({
    newPassword: z.string().min(8, { message: 'Password must be at least 8 characters' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type PasswordFormValues = z.infer<typeof passwordSchema>

export function ChangePasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [successOpen, setSuccessOpen] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
  })

  async function onSubmit(values: PasswordFormValues) {
    setServerError(null)

    try {
      const result = await updatePassword(values.newPassword)

      if (!result.success) {
        setServerError(result.error)
        return
      }

      reset()
      setSuccessOpen(true)
    } catch {
      setServerError('Unable to update password. Please try again.')
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="newPassword" className="text-signara-navy font-medium">
          New password
        </Label>
        <Input
          id="newPassword"
          type="password"
          placeholder="Min. 8 characters"
          autoComplete="new-password"
          {...register('newPassword')}
          aria-invalid={!!errors.newPassword}
          className="border-signara-steel focus-visible:ring-signara-navy"
        />
        {errors.newPassword && (
          <p className="text-destructive text-xs">{errors.newPassword.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword" className="text-signara-navy font-medium">
          Confirm new password
        </Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="Repeat your new password"
          autoComplete="new-password"
          {...register('confirmPassword')}
          aria-invalid={!!errors.confirmPassword}
          className="border-signara-steel focus-visible:ring-signara-navy"
        />
        {errors.confirmPassword && (
          <p className="text-destructive text-xs">{errors.confirmPassword.message}</p>
        )}
      </div>

      {serverError && <ErrorMessage>{serverError}</ErrorMessage>}

      <Button
        type="submit"
        disabled={isSubmitting}
        variant="signara"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Updating…
          </>
        ) : (
          'Update password'
        )}
      </Button>
    </form>

      <SuccessModal
        open={successOpen}
        onOpenChange={setSuccessOpen}
        title="Password updated"
        description="Your password has been changed successfully."
      />
    </>
  )
}
