import { CheckCircle2, Clock, MinusCircle, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { parseStepNotes } from '@/lib/workflow/step-notes'
import { formatUserDisplayName } from '@/lib/users/display-name'
import { JOB_LEVEL_LABELS } from '@/types/org-structure'
import type { JobLevel } from '@/types/org-structure'
import type { DocumentStep } from '@/types/database'

export interface ApprovalProgressStep extends DocumentStep {
  users: {
    full_name: string
    position: string | null
    email: string
    job_level: JobLevel
    departments: { name: string } | null
  } | null
}

interface ApprovalProgressProps {
  steps: ApprovalProgressStep[]
  /** When true, copy is framed for the document initiator tracking their request. */
  isInitiator?: boolean
}

const STEP_STATUS_BADGE_CLASS: Record<DocumentStep['status'], string> = {
  approved: 'border-green-200 bg-green-50 text-green-700',
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  rejected: 'border-red-200 bg-red-50 text-red-700',
  waiting: 'border-signara-steel/30 text-signara-steel',
  skipped: 'border-signara-steel/30 text-signara-steel',
}

const STEP_STATUS_LABEL: Record<DocumentStep['status'], string> = {
  approved: 'Approved',
  pending: 'Awaiting approval',
  rejected: 'Rejected',
  waiting: 'Not yet reached',
  skipped: 'Skipped',
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StepStatusIcon({ status }: { status: DocumentStep['status'] }) {
  if (status === 'approved') {
    return <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-600" aria-hidden />
  }
  if (status === 'rejected') {
    return <XCircle className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden />
  }
  if (status === 'pending') {
    return <Clock className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
  }
  if (status === 'skipped') {
    return <MinusCircle className="mt-0.5 size-5 shrink-0 text-signara-steel/50" aria-hidden />
  }
  return <Clock className="mt-0.5 size-5 shrink-0 text-signara-steel/40" aria-hidden />
}

function stepOutcomeText(step: ApprovalProgressStep): string | null {
  const name = step.users
    ? formatUserDisplayName(step.users.full_name, step.users.position)
    : 'Approver'
  const meta = parseStepNotes(step.notes)

  switch (step.status) {
    case 'approved':
      if (step.signed_at) {
        return `Approved by ${name} on ${formatDateTime(step.signed_at)}`
      }
      return `Approved by ${name}`
    case 'rejected':
      if (meta.rejectedAt) {
        return `Rejected by ${name} on ${formatDateTime(meta.rejectedAt)}`
      }
      if (step.updated_at) {
        return `Rejected by ${name} on ${formatDateTime(step.updated_at)}`
      }
      return `Rejected by ${name}`
    case 'pending':
      return `Waiting for ${name} to approve`
    case 'waiting':
      return `${name} has not approved yet — earlier steps must finish first`
    case 'skipped':
      return meta.rejectionReason
        ? 'Skipped because an earlier step was rejected'
        : 'This step was skipped'
    default:
      return null
  }
}

export function ApprovalProgress({ steps, isInitiator = false }: ApprovalProgressProps) {
  const actionableSteps = steps.filter((step) => step.status !== 'skipped')
  const approvedCount = steps.filter((step) => step.status === 'approved').length
  const totalCount = actionableSteps.length || steps.length
  const progressPercent =
    totalCount === 0 ? 0 : Math.round((approvedCount / totalCount) * 100)

  const activeStep = steps.find((step) => step.status === 'pending')
  const rejectedStep = steps.find((step) => step.status === 'rejected')

  let summary: string
  if (steps.length === 0) {
    summary = 'No approval steps on this document'
  } else if (rejectedStep) {
    summary = `Rejected at step ${(rejectedStep.step_order ?? 0) + 1} of ${steps.length}`
  } else if (approvedCount === totalCount && totalCount > 0) {
    summary = `All ${totalCount} approver${totalCount === 1 ? '' : 's'} have signed`
  } else if (activeStep) {
    summary = `${approvedCount} of ${totalCount} approved — currently with ${
      activeStep.users
        ? formatUserDisplayName(activeStep.users.full_name, activeStep.users.position)
        : 'the next approver'
    }`
  } else {
    summary = `${approvedCount} of ${totalCount} approved`
  }

  return (
    <div className="rounded-lg border border-signara-steel/30 bg-white shadow-sm">
      <div className="border-b border-signara-steel/20 px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-signara-navy">
              {isInitiator ? 'Approval progress' : 'Approval chain'}
            </h3>
            <p className="mt-0.5 text-sm text-signara-steel">
              {isInitiator
                ? 'Track which approvers have signed and who still needs to act'
                : 'Runs in order, one step at a time'}
            </p>
          </div>
          <p className="text-sm font-medium text-signara-navy">{summary}</p>
        </div>

        {totalCount > 0 && (
          <div className="mt-4">
            <div
              className="h-2 overflow-hidden rounded-full bg-signara-steel/20"
              role="progressbar"
              aria-valuenow={approvedCount}
              aria-valuemin={0}
              aria-valuemax={totalCount}
              aria-label="Approval progress"
            >
              <div
                className={`h-full rounded-full transition-all ${
                  rejectedStep ? 'bg-red-500' : 'bg-signara-gold'
                }`}
                style={{ width: `${rejectedStep ? Math.max(progressPercent, 8) : progressPercent}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-signara-steel">
              {approvedCount} approved · {totalCount - approvedCount} remaining
              {rejectedStep ? ' · chain stopped' : ''}
            </p>
          </div>
        )}
      </div>

      {steps.length === 0 ? (
        <p className="px-6 py-8 text-sm text-signara-steel">
          No approvers have been assigned to this document yet.
        </p>
      ) : (
        <ol className="divide-y divide-signara-steel/10">
          {steps.map((step, index) => {
            const meta = parseStepNotes(step.notes)
            const assignee = step.users
            const outcome = stepOutcomeText(step)

            return (
              <li key={step.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <StepStatusIcon status={step.status} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-signara-navy">
                        Step {index + 1}:{' '}
                        {assignee
                          ? formatUserDisplayName(assignee.full_name, assignee.position)
                          : 'Unassigned'}
                      </p>
                      {assignee?.email && (
                        <p className="text-xs text-signara-steel">{assignee.email}</p>
                      )}
                      {(meta.resolvedDepartmentName || meta.minJobLevel) && (
                        <p className="mt-1 text-xs text-signara-steel">
                          {meta.resolvedDepartmentName ?? 'Organisation-wide'}
                          {meta.minJobLevel
                            ? ` · ${JOB_LEVEL_LABELS[meta.minJobLevel]} and above`
                            : ''}
                        </p>
                      )}
                      {meta.authorityText && (
                        <p className="mt-2 text-sm text-signara-navy/80">{meta.authorityText}</p>
                      )}
                      {outcome && (
                        <p
                          className={`mt-2 text-xs ${
                            step.status === 'approved'
                              ? 'font-medium text-green-700'
                              : step.status === 'rejected'
                                ? 'font-medium text-red-700'
                                : step.status === 'pending'
                                  ? 'font-medium text-amber-800'
                                  : 'text-signara-steel'
                          }`}
                        >
                          {outcome}
                        </p>
                      )}
                      {step.status === 'rejected' && meta.rejectionReason && (
                        <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                          Reason: {meta.rejectionReason}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className={STEP_STATUS_BADGE_CLASS[step.status]}>
                    {STEP_STATUS_LABEL[step.status]}
                  </Badge>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
