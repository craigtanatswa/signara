'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { OrgBrandingUpload } from '@/components/settings/org-branding-upload'
import { BrandThemePicker } from '@/components/settings/brand-theme-picker'
import {
  removeOrganisationLandscapeLetterhead,
  removeOrganisationLetterhead,
  removeOrganisationLogo,
  uploadOrganisationLandscapeLetterhead,
  uploadOrganisationLetterhead,
  uploadOrganisationLogo,
} from '@/app/actions/organisation-branding'
import { updateOrganisation } from '@/app/actions/profile'
import { SuccessModal } from '@/components/ui/success-modal'
import { ErrorMessage } from '@/components/ui/error-message'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { Organisation, Plan } from '@/types/database'

const orgSchema = z.object({
  name: z.string().min(2, { message: 'Organisation name must be at least 2 characters' }),
  archive_policy_months: z
    .number({ error: 'Enter a whole number of months' })
    .int({ message: 'Enter a whole number of months' })
    .min(0, { message: 'Enter 0 to disable automatic archiving' })
    .max(120, { message: 'Maximum is 120 months' }),
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
    defaultValues: {
      name: organisation.name,
      archive_policy_months: organisation.archive_policy_months ?? 12,
    },
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

        <div className="space-y-1.5 rounded-lg border border-signara-steel/30 bg-signara-background/40 p-4">
          <Label htmlFor="archive_policy_months" className="text-signara-navy font-medium">
            Hide documents from the main list after
          </Label>
          <p className="text-sm text-signara-steel">
            Completed and rejected documents older than this period are automatically hidden
            from the default Documents list. They remain available when users turn on{' '}
            <span className="font-medium text-signara-navy">Show archived documents</span>, on
            the Archive page, and can still be downloaded. Set to{' '}
            <span className="font-medium text-signara-navy">0</span> to disable automatic
            archiving — admins can still archive manually from the All tab.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <Input
              id="archive_policy_months"
              type="number"
              min={0}
              max={120}
              step={1}
              {...register('archive_policy_months', { valueAsNumber: true })}
              aria-invalid={!!errors.archive_policy_months}
              className="w-24 border-signara-steel focus-visible:ring-signara-navy"
            />
            <span className="text-sm text-signara-navy">months</span>
          </div>
          {errors.archive_policy_months && (
            <p className="text-destructive text-xs">{errors.archive_policy_months.message}</p>
          )}
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

      <BrandThemePicker currentTheme={organisation.brand_theme} />

      <OrgBrandingUpload
        label="Organisation logo"
        description="Optional. Shown on templates and documents. PNG, JPEG, or SVG — max 2MB. Raster images are resized to 400px wide."
        currentUrl={organisation.logo_url}
        accept="image/png,image/jpeg,image/svg+xml"
        emptyHint="No logo uploaded — templates will omit the header logo."
        previewAlt="Organisation logo"
        previewClassName="max-h-24 max-w-full object-contain"
        onUpload={uploadOrganisationLogo}
        onRemove={removeOrganisationLogo}
      />

      <OrgBrandingUpload
        label="Letterhead background (portrait)"
        description="Optional. Full-page background on portrait templates. Upload PNG or PDF (Word: Save As PDF). PDFs are converted to high-resolution PNG automatically."
        currentUrl={organisation.letterhead_url}
        accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
        emptyHint="No portrait letterhead uploaded — portrait templates use a plain white page background."
        previewAlt="Portrait letterhead background preview"
        previewClassName="max-h-40 max-w-full object-contain"
        onUpload={uploadOrganisationLetterhead}
        onRemove={removeOrganisationLetterhead}
      />

      <OrgBrandingUpload
        label="Letterhead background (landscape)"
        description="Optional. Full-page background on landscape templates. Upload a landscape PNG or PDF exported from Word."
        currentUrl={organisation.letterhead_landscape_url}
        accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
        emptyHint="No landscape letterhead uploaded — landscape templates use a plain white page background."
        previewAlt="Landscape letterhead background preview"
        previewClassName="max-h-40 max-w-full object-contain"
        onUpload={uploadOrganisationLandscapeLetterhead}
        onRemove={removeOrganisationLandscapeLetterhead}
      />

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
