'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, ShieldCheck } from 'lucide-react'
import { updatePassword } from '@/app/actions/profile'
import { SuccessModal } from '@/components/ui/success-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const changePasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>

export default function ChangePasswordPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [successOpen, setSuccessOpen] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
  })

  async function onSubmit(values: ChangePasswordFormValues) {
    setServerError(null)

    try {
      const result = await updatePassword(values.newPassword)

      if (!result.success) {
        setServerError(result.error)
        return
      }

      setSuccessOpen(true)
    } catch {
      setServerError('Unable to update password. Please try again.')
    }
  }

  function handleSuccessConfirm() {
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <>
    <div className="space-y-8">
      <div className="flex flex-col items-center space-y-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-signara-navy/10">
          <ShieldCheck className="size-7 text-signara-navy" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-signara-navy">
            Create a new password
          </h1>
          <p className="text-signara-steel text-sm max-w-sm">
            Your account was set up by your administrator. Please create a new
            password to continue.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1.5">
          <Label
            htmlFor="newPassword"
            className="text-signara-navy font-medium"
          >
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
            <p className="text-destructive text-xs">
              {errors.newPassword.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="confirmPassword"
            className="text-signara-navy font-medium"
          >
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
            <p className="text-destructive text-xs">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {serverError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
            <p className="text-destructive text-sm">{serverError}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={isSubmitting}
          variant="signara"
          className="w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Updating password…
            </>
          ) : (
            'Set new password'
          )}
        </Button>
      </form>
    </div>

      <SuccessModal
        open={successOpen}
        onOpenChange={setSuccessOpen}
        title="Password set"
        description="Your new password has been saved. You can now access your dashboard."
        confirmLabel="Continue to dashboard"
        onConfirm={handleSuccessConfirm}
      />
    </>
  )
}
