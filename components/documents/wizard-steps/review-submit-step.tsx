'use client'

import { Loader2, PlayCircle, User as UserIcon } from 'lucide-react'
import { SIGNATURE_REVIEW_CLASS } from '@/lib/signatures/constants'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorMessage } from '@/components/ui/error-message'
import { Button } from '@/components/ui/button'
import { getAttachmentFilename } from '@/lib/storage/document-attachments'
import type { FormFieldAttrs } from '@/types/database'
import type { InitiationStepInfo } from '@/app/actions/documents'

export interface ReviewFieldEntry {
  attrs: FormFieldAttrs
  value: unknown
}

interface ReviewSubmitStepProps {
  title: string
  onTitleChange: (title: string) => void
  fieldEntries: ReviewFieldEntry[]
  steps: InitiationStepInfo[]
  assignments: Record<string, string>
  approverNamesById: Map<string, string>
  serverError: string | null
  isSubmitting: boolean
  onSubmit: () => void
}

function formatFieldValue(entry: ReviewFieldEntry): string {
  const { attrs, value } = entry

  if (value === undefined || value === null || value === '') return '—'

  if (attrs.fieldType === 'signature') {
    return typeof value === 'string' && value.startsWith('data:image/') ? 'Signed' : '—'
  }

  if (attrs.fieldType === 'checkbox') {
    return value ? 'Yes' : 'No'
  }

  if (attrs.fieldType === 'file' && typeof value === 'string') {
    return getAttachmentFilename(value)
  }

  if (attrs.fieldType === 'date' && typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-GB')
  }

  return String(value)
}

export function ReviewSubmitStep({
  title,
  onTitleChange,
  fieldEntries,
  steps,
  assignments,
  approverNamesById,
  serverError,
  isSubmitting,
  onSubmit,
}: ReviewSubmitStepProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-signara-steel/30 bg-white p-6 shadow-sm">
        <div className="space-y-1.5">
          <Label htmlFor="document-title" className="text-signara-navy font-medium">
            Document title
          </Label>
          <Input
            id="document-title"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            className="border-signara-steel focus-visible:ring-signara-navy"
            required
          />
        </div>
      </div>

      <div className="rounded-lg border border-signara-steel/30 bg-white shadow-sm">
        <div className="border-b border-signara-steel/20 px-6 py-4">
          <h3 className="font-semibold text-signara-navy">Details</h3>
        </div>
        {fieldEntries.length === 0 ? (
          <p className="px-6 py-4 text-sm text-signara-steel">No fields to review.</p>
        ) : (
          <dl className="divide-y divide-signara-steel/10">
            {fieldEntries.map((entry) => {
              const isSignatureImage =
                entry.attrs.fieldType === 'signature' &&
                typeof entry.value === 'string' &&
                entry.value.startsWith('data:image/')

              return (
                <div key={entry.attrs.fieldId} className="grid gap-1 px-6 py-3 sm:grid-cols-2 sm:gap-4">
                  <dt className="text-sm text-signara-steel">{entry.attrs.label}</dt>
                  <dd className="text-sm font-medium text-signara-navy">
                    {isSignatureImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={entry.value as string}
                        alt={entry.attrs.label}
                        className={SIGNATURE_REVIEW_CLASS}
                      />
                    ) : (
                      formatFieldValue(entry)
                    )}
                  </dd>
                </div>
              )
            })}
          </dl>
        )}
      </div>

      <div className="rounded-lg border border-signara-steel/30 bg-white shadow-sm">
        <div className="border-t-2 border-signara-gold px-6 py-4">
          <h3 className="font-semibold text-signara-navy">Approval chain</h3>
          <p className="mt-0.5 text-sm text-signara-steel">Runs in order once you submit</p>
        </div>
        <ol className="divide-y divide-signara-steel/10 px-6 py-2">
          <li className="flex items-center gap-2 py-2 text-sm text-signara-navy">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-signara-gold text-xs font-semibold text-signara-navy">
              1
            </span>
            <UserIcon className="size-3.5 text-signara-steel" />
            <span className="font-medium">You</span>
            <span className="text-signara-steel">(initiator)</span>
          </li>
          {steps.map((step) => {
            const approverId = assignments[step.workflowStepId]
            const approverName = approverId ? approverNamesById.get(approverId) : undefined
            const isSkipped = !approverId
            return (
              <li key={step.workflowStepId} className="flex items-center gap-2 py-2 text-sm text-signara-navy">
                <span
                  className={
                    isSkipped
                      ? 'flex size-6 shrink-0 items-center justify-center rounded-full bg-signara-steel/30 text-xs font-semibold text-signara-steel'
                      : 'flex size-6 shrink-0 items-center justify-center rounded-full bg-signara-navy text-xs font-semibold text-white'
                  }
                >
                  {step.stepNumber + 1}
                </span>
                <UserIcon className="size-3.5 text-signara-steel" />
                <span className="font-medium">{isSkipped ? 'Skipped' : (approverName ?? 'Not assigned')}</span>
                <span className="text-signara-steel">({step.policyLabel})</span>
              </li>
            )
          })}
        </ol>
      </div>

      {serverError && <ErrorMessage>{serverError}</ErrorMessage>}

      <Button type="button" variant="signara" disabled={isSubmitting} onClick={onSubmit}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Submitting…
          </>
        ) : (
          <>
            <PlayCircle className="mr-2 size-4" />
            Submit for approval
          </>
        )}
      </Button>
    </div>
  )
}
