'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { registerOrganisation } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/error-message'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const registerSchema = z
  .object({
    organisationName: z
      .string()
      .min(2, { message: 'Organisation name must be at least 2 characters' }),
    fullName: z
      .string()
      .min(2, { message: 'Full name must be at least 2 characters' }),
    email: z.string().email({ message: 'Please enter a valid email address' }),
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters' }),
    confirmPassword: z.string(),
    isManagingDirector: z.boolean().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type RegisterFormValues = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      isManagingDirector: false,
    },
  })

  async function onSubmit(values: RegisterFormValues) {
    setServerError(null)
    const result = await registerOrganisation({
      organisationName: values.organisationName,
      fullName: values.fullName,
      email: values.email,
      password: values.password,
      isManagingDirector: values.isManagingDirector === true,
    })

    if (!result.success) {
      setServerError(result.error)
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-signara-navy">
          Create your organisation
        </h1>
        <p className="text-signara-steel text-sm">
          Start your free trial — no credit card required
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label
            htmlFor="organisationName"
            className="text-signara-navy font-medium"
          >
            Organisation name
          </Label>
          <Input
            id="organisationName"
            placeholder="Acme Corporation"
            {...register('organisationName')}
            aria-invalid={!!errors.organisationName}
            className="border-signara-steel focus-visible:ring-signara-navy"
          />
          {errors.organisationName && (
            <p className="text-destructive text-xs">
              {errors.organisationName.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fullName" className="text-signara-navy font-medium">
            Your full name
          </Label>
          <Input
            id="fullName"
            placeholder="Jane Smith"
            autoComplete="name"
            {...register('fullName')}
            aria-invalid={!!errors.fullName}
            className="border-signara-steel focus-visible:ring-signara-navy"
          />
          {errors.fullName && (
            <p className="text-destructive text-xs">
              {errors.fullName.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-signara-navy font-medium">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="jane@email.com"
            autoComplete="email"
            {...register('email')}
            aria-invalid={!!errors.email}
            className="border-signara-steel focus-visible:ring-signara-navy"
          />
          {errors.email && (
            <p className="text-destructive text-xs">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-signara-navy font-medium">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="Min. 8 characters"
            autoComplete="new-password"
            {...register('password')}
            aria-invalid={!!errors.password}
            className="border-signara-steel focus-visible:ring-signara-navy"
          />
          {errors.password && (
            <p className="text-destructive text-xs">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="confirmPassword"
            className="text-signara-navy font-medium"
          >
            Confirm password
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Repeat your password"
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

        <label className="flex items-start gap-3 rounded-lg border border-signara-steel/30 bg-signara-background/60 p-3 text-sm text-signara-navy">
          <input
            type="checkbox"
            className="mt-0.5 size-4 rounded border-signara-steel accent-signara-gold"
            {...register('isManagingDirector')}
          />
          <span>
            <span className="font-medium">I am the Managing Director</span>
            <span className="mt-0.5 block text-signara-steel">
              Optional. Leave unchecked if you are a systems admin — the MD can
              be assigned later on the Team page.
            </span>
          </span>
        </label>

        {serverError && <ErrorMessage>{serverError}</ErrorMessage>}

        <Button
          type="submit"
          disabled={isSubmitting}
          variant="signara"
          className="mt-2 w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Creating account…
            </>
          ) : (
            'Create account'
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-signara-steel">
        Already have an account?{' '}
        <Link
          href="/login"
          className="text-signara-gold font-medium hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
