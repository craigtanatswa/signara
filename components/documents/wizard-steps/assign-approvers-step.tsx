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

interface AssignApproversStepProps {
  steps: InitiationStepInfo[]
  assignments: Record<string, string>
  onChange: (workflowStepId: string, userId: string) => void
  blockingError?: string
  isLoading?: boolean
}

export function AssignApproversStep({
  steps,
  assignments,
  onChange,
  blockingError,
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
        Choose an approver for each step below. Every approver must be more senior than you, and
        the chain runs in order — the next approver is notified once the previous one signs.
      </p>

      {blockingError && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-800">
          <TriangleAlert />
          <AlertDescription className="text-amber-800">{blockingError}</AlertDescription>
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
                    No one is eligible to approve this step for you.
                  </p>
                ) : (
                  <Select
                    value={selectedId}
                    onValueChange={(value) => onChange(step.workflowStepId, value)}
                  >
                    <SelectTrigger className="w-full border-signara-steel focus:ring-signara-navy">
                      <SelectValue placeholder="Select an approver" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((approver) => (
                        <SelectItem key={approver.id} value={approver.id}>
                          {approver.full_name}
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
