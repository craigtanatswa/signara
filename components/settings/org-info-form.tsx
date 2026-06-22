'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Upload } from 'lucide-react'
import { updateOrganisation } from '@/app/actions/profile'
import { SuccessModal } from '@/components/ui/success-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { Organisation, Plan } from '@/types/database'

const orgSchema = z.object({
  name: z.string().min(2, { message: 'Organisation name must be at least 2 characters' }),
})

type OrgFormValues = z.infer<typeof orgSchema>

interface OrgInfoFormProps {
  organisation: Organisation
  plan: Plan | null
}

function formatTrialEnd(dateStr: string | null): string | null {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function OrgInfoForm({ organisation, plan }: OrgInfoFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [successOpen, setSuccessOpen] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<OrgFormValues>({
    resolver: zodResolver(orgSchema),
    defaultValues: { name: organisation.name },
  })

  async function onSubmit(values: OrgFormValues) {
    setServerError(null)
    const result = await updateOrganisation(values)

    if (!result.success) {
      setServerError(result.error)
      return
    }

    setSuccessOpen(true)
  }

  const trialEnd = formatTrialEnd(organisation.trial_ends_at)

  return (
    <>
    <div className="space-y-8">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Org name */}
        <div className="space-y-1.5">
          <Label htmlFor="org_name" className="text-signara-navy font-medium">
            Organisation name
          </Label>
          <Input
            id="org_name"
            {...register('name')}
            aria-invalid={!!errors.name}
            className="border-signara-steel focus-visible:ring-signara-navy"
          />
          {errors.name && (
            <p className="text-destructive text-xs">{errors.name.message}</p>
          )}
        </div>

        {serverError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
            <p className="text-destructive text-sm">{serverError}</p>
          </div>
        )}

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

      {/* Logo upload placeholder */}
      <div className="space-y-1.5">
        <Label className="text-signara-navy font-medium">Organisation logo</Label>
        <div className="flex h-32 cursor-not-allowed items-center justify-center rounded-lg border-2 border-dashed border-signara-steel/40 bg-signara-background/50">
          <div className="flex flex-col items-center gap-2 text-center">
            <Upload className="size-6 text-signara-steel/50" />
            <p className="text-sm text-signara-steel">Logo upload coming soon</p>
          </div>
        </div>
      </div>

      {/* Plan info */}
      <div className="rounded-lg border border-signara-steel/30 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-signara-steel mb-3">
          Current plan
        </p>
        <div className="flex items-center gap-3">
          <Badge className="bg-signara-navy/10 text-signara-navy border-signara-navy/20" variant="outline">
            {plan?.name ?? 'Trial'}
          </Badge>
          {trialEnd && (
            <p className="text-sm text-signara-steel">
              Trial ends <span className="text-signara-navy font-medium">{trialEnd}</span>
            </p>
          )}
        </div>
      </div>
    </div>

      <SuccessModal
        open={successOpen}
        onOpenChange={setSuccessOpen}
        title="Organisation updated"
        description="Your organisation details have been saved successfully."
      />
    </>
  )
}
