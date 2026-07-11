'use client'

import { useMemo } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { InitiationStepInfo } from '@/app/actions/documents'
import { formatUserDisplayName } from '@/lib/users/display-name'

const SKIP_VALUE = '__skip__'

interface AssignApproversStepProps {
  steps: InitiationStepInfo[]
  assignments: Record<string, string>
  onChange: (workflowStepId: string, userId: string | null) => void
  blockingError?: string
  shortageWarnings?: string[]
  isLoading?: boolean
}

export function AssignApproversStep({
  steps,
  assignments,
  onChange,
  blockingError,
  shortageWarnings,
  isLoading,
}: AssignApproversStepProps) {
  const usedApproverIds = useMemo(() => new Set(Object.values(assignments)), [assignments])

  if (isLoading) {
    return (
      <div className="rounded-lg border border-signara-steel/30 bg-white p-8 text-center text-sm text-signara-steel shadow-sm">
        Checking who&apos;s eligible to approve this document…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-signara-steel">
        Choose an approver for each step from the options set by the admin approval flow. Options
        are based on department and minimum job level. If no one is available for a step, leave it
        empty to skip that step — you&apos;ll be asked to confirm before submitting.
      </p>

      {blockingError && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-800">
          <TriangleAlert />
          <AlertDescription className="text-amber-800">{blockingError}</AlertDescription>
        </Alert>
      )}

      {shortageWarnings && shortageWarnings.length > 0 && !blockingError && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-800">
          <TriangleAlert />
          <AlertDescription className="space-y-1 text-amber-800">
            {shortageWarnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {steps.length === 0 && !blockingError && (
        <p className="rounded-lg border border-dashed border-signara-steel/40 bg-white p-6 text-center text-sm text-signara-steel">
          This template has no approval steps to assign.
        </p>
      )}

      <div className="space-y-4">
        {steps.map((step) => {
          const selectedId = assignments[step.workflowStepId] ?? ''
          const options = step.eligibleApprovers.filter(
            (approver) => approver.id === selectedId || !usedApproverIds.has(approver.id)
          )

          return (
            <div
              key={step.workflowStepId}
              className="rounded-lg border border-signara-steel/30 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-signara-navy">Step {step.stepNumber}</p>
                  <p className="text-xs text-signara-steel">{step.policyLabel}</p>
                </div>
              </div>

              {step.authorityText && (
                <p className="mt-2 text-sm text-signara-navy/80">{step.authorityText}</p>
              )}

              <div className="mt-3 space-y-1.5">
                <Label className="text-signara-navy font-medium">Approver</Label>
                {step.eligibleApprovers.length === 0 ? (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    No one is eligible for this step. Leave it empty to skip it.
                  </p>
                ) : (
                  <Select
                    value={selectedId || SKIP_VALUE}
                    onValueChange={(value) =>
                      onChange(step.workflowStepId, value === SKIP_VALUE ? null : value)
                    }
                  >
                    <SelectTrigger className="w-full border-signara-steel focus:ring-signara-navy">
                      <SelectValue placeholder="Select an approver" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SKIP_VALUE}>Skip this step</SelectItem>
                      {options.map((approver) => (
                        <SelectItem key={approver.id} value={approver.id}>
                          {formatUserDisplayName(approver.full_name, approver.position)}
                          {approver.department_name ? ` — ${approver.department_name}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
