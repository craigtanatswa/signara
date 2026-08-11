'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { applyViaJoinLink } from '@/app/actions/join'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/error-message'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z
  .object({
    fullName: z.string().min(2, { message: 'Full name must be at least 2 characters' }),
    email: z.string().email({ message: 'Enter a valid email address' }),
    password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type FormValues = z.infer<typeof schema>

export function ShareableJoinForm({
  token,
  orgName,
}: {
  token: string
  orgName: string
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    const result = await applyViaJoinLink({
      token,
      fullName: values.fullName,
      email: values.email,
      password: values.password,
    })
    if (!result.success) {
      setServerError(result.error)
      return
    }
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold text-signara-navy">Request submitted</h1>
        <p className="text-sm text-signara-steel">
          An administrator at {orgName} will review your request. You&apos;ll get an email when
          they approve or reject it.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-signara-navy">Request to join {orgName}</h1>
        <p className="text-sm text-signara-steel">
          Create your account. An admin must approve you before you can access the organisation.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName" className="font-medium text-signara-navy">
            Full name
          </Label>
          <Input
            id="fullName"
            className="border-signara-steel focus-visible:ring-signara-navy"
            {...register('fullName')}
          />
          {errors.fullName && (
            <p className="text-xs text-destructive">{errors.fullName.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email" className="font-medium text-signara-navy">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            className="border-signara-steel focus-visible:ring-signara-navy"
            {...register('email')}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password" className="font-medium text-signara-navy">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            className="border-signara-steel focus-visible:ring-signara-navy"
            {...register('password')}
          />
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="font-medium text-signara-navy">
            Confirm password
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            className="border-signara-steel focus-visible:ring-signara-navy"
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>

        {serverError && <ErrorMessage>{serverError}</ErrorMessage>}

        <Button type="submit" variant="signara" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Submitting…
            </>
          ) : (
            'Request to join'
          )}
        </Button>
      </form>
    </div>
  )
}
