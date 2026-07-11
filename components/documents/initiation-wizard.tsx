'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  createDocumentFromTemplate,
  getDocumentInitiationContext,
  type InitiationStepInfo,
} from '@/app/actions/documents'
import { formatUserDisplayName } from '@/lib/users/display-name'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ErrorMessage } from '@/components/ui/error-message'
import { listTemplateFieldsWithRoles } from '@/lib/tiptap/field-utils'
import { isFillDetailsField } from '@/lib/tiptap/field-schema'
import { cn } from '@/lib/utils'
import { FillDetailsStep, type FillDetailsStepHandle } from '@/components/documents/wizard-steps/fill-details-step'
import { AssignApproversStep } from '@/components/documents/wizard-steps/assign-approvers-step'
import { ReviewSubmitStep, type ReviewFieldEntry } from '@/components/documents/wizard-steps/review-submit-step'
import type { OrganisationBranding, TiptapDocument } from '@/types/database'

const WIZARD_STEPS = [
  { key: 'template', label: 'Choose template' },
  { key: 'details', label: 'Fill details' },
  { key: 'approvers', label: 'Assign approvers' },
  { key: 'review', label: 'Review & submit' },
] as const

type WizardStepKey = (typeof WIZARD_STEPS)[number]['key']

interface InitiationWizardProps {
  templateId: string
  templateName: string
  templateContent: TiptapDocument | null
  organisationBranding?: OrganisationBranding | null
  initialSteps: InitiationStepInfo[]
  initialBlockingError?: string
  initialShortageWarnings?: string[]
}

export function InitiationWizard({
  templateId,
  templateName,
  templateContent,
  organisationBranding = null,
  initialSteps,
  initialBlockingError,
  initialShortageWarnings,
}: InitiationWizardProps) {
  const router = useRouter()
  const [draftId] = useState(() => crypto.randomUUID())
  const [currentStepIndex, setCurrentStepIndex] = useState(1) // 0 = template (already done)
  const [formValues, setFormValues] = useState<Record<string, unknown>>({})
  const [steps, setSteps] = useState<InitiationStepInfo[]>(initialSteps)
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [blockingError, setBlockingError] = useState<string | undefined>(initialBlockingError)
  const [shortageWarnings, setShortageWarnings] = useState<string[]>(initialShortageWarnings ?? [])
  const [title, setTitle] = useState(`${templateName} — ${new Date().toLocaleDateString('en-GB')}`)
  const [serverError, setServerError] = useState<string | null>(null)
  const [emptyStepsWarningOpen, setEmptyStepsWarningOpen] = useState(false)
  const [isRefreshingSteps, startRefreshTransition] = useTransition()
  const [isSubmitting, startSubmitTransition] = useTransition()

  const fillDetailsRef = useRef<FillDetailsStepHandle>(null)

  const fields = useMemo(
    () => listTemplateFieldsWithRoles(templateContent).filter(isFillDetailsField),
    [templateContent]
  )

  const currentStepKey: WizardStepKey = WIZARD_STEPS[currentStepIndex].key

  const emptyApproverSteps = useMemo(
    () => steps.filter((step) => !assignments[step.workflowStepId]),
    [steps, assignments]
  )

  const hasAtLeastOneApprover = steps.some((step) => Boolean(assignments[step.workflowStepId]))

  const canContinueApprovers = steps.length > 0 && !blockingError && hasAtLeastOneApprover

  async function handleContinue() {
    setServerError(null)

    if (currentStepKey === 'details') {
      const valid = await fillDetailsRef.current?.requestContinue()
      if (!valid) return
      return
    }

    if (currentStepKey === 'approvers') {
      setCurrentStepIndex(3)
      return
    }
  }

  function handleFillDetailsContinue(values: Record<string, unknown>) {
    setFormValues(values)
    startRefreshTransition(async () => {
      const context = await getDocumentInitiationContext(templateId, values)
      if ('error' in context) {
        setBlockingError(context.error)
        setShortageWarnings([])
        setSteps([])
      } else {
        setSteps(context.steps)
        setBlockingError(context.blockingError ?? undefined)
        setShortageWarnings(context.shortageWarnings ?? [])
        setAssignments((prev) => {
          const validIds = new Set(context.steps.map((step) => step.workflowStepId))
          return Object.fromEntries(Object.entries(prev).filter(([stepId]) => validIds.has(stepId)))
        })
      }
      setCurrentStepIndex(2)
    })
  }

  function handleAssignmentChange(workflowStepId: string, userId: string | null) {
    setAssignments((prev) => {
      if (!userId) {
        const next = { ...prev }
        delete next[workflowStepId]
        return next
      }
      return { ...prev, [workflowStepId]: userId }
    })
  }

  function submitDocument() {
    setServerError(null)
    startSubmitTransition(async () => {
      const result = await createDocumentFromTemplate({
        templateId,
        title,
        data: formValues,
        assignments: steps
          .filter((step) => Boolean(assignments[step.workflowStepId]))
          .map((step) => ({
            workflowStepId: step.workflowStepId,
            userId: assignments[step.workflowStepId],
          })),
      })

      if ('error' in result) {
        setServerError(result.error ?? 'Something went wrong. Please try again.')
        return
      }

      toast.success('Document submitted for approval')
      router.push(`/dashboard/documents/${result.documentId}`)
      router.refresh()
    })
  }

  function handleSubmit() {
    if (emptyApproverSteps.length > 0) {
      setEmptyStepsWarningOpen(true)
      return
    }
    submitDocument()
  }

  function handleConfirmEmptySteps() {
    setEmptyStepsWarningOpen(false)
    submitDocument()
  }

  const approverNamesById = useMemo(() => {
    const map = new Map<string, string>()
    for (const step of steps) {
      for (const approver of step.eligibleApprovers) {
        map.set(approver.id, formatUserDisplayName(approver.full_name, approver.position))
      }
    }
    return map
  }, [steps])

  const fieldEntries: ReviewFieldEntry[] = useMemo(
    () => fields.map((attrs) => ({ attrs, value: formValues[attrs.fieldId] })),
    [fields, formValues]
  )

  const continueDisabled =
    (currentStepKey === 'approvers' && !canContinueApprovers) || isRefreshingSteps

  const showWizardFooter = currentStepKey === 'details' || currentStepKey === 'approvers'

  return (
    <>
      <div className={cn('space-y-3', showWizardFooter && 'pb-24')}>
        <StepIndicator currentIndex={currentStepIndex} />

        {currentStepKey === 'details' && (
          <FillDetailsStep
            ref={fillDetailsRef}
            templateContent={templateContent}
            organisationBranding={organisationBranding}
            draftId={draftId}
            defaultValues={formValues}
            onContinue={handleFillDetailsContinue}
          />
        )}

        {currentStepKey === 'approvers' && (
          <AssignApproversStep
            steps={steps}
            assignments={assignments}
            onChange={handleAssignmentChange}
            blockingError={blockingError}
            shortageWarnings={shortageWarnings}
            isLoading={isRefreshingSteps}
          />
        )}

        {currentStepKey === 'review' && (
          <ReviewSubmitStep
            title={title}
            onTitleChange={setTitle}
            fieldEntries={fieldEntries}
            steps={steps}
            assignments={assignments}
            approverNamesById={approverNamesById}
            serverError={serverError}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
          />
        )}

        {serverError && currentStepKey !== 'review' && <ErrorMessage>{serverError}</ErrorMessage>}
      </div>

      {showWizardFooter && (
        <div className="fixed bottom-0 left-60 right-0 z-30 border-t border-signara-steel/25 bg-white/95 shadow-[0_-4px_16px_rgba(15,44,89,0.08)] backdrop-blur-sm">
          <div className="mx-auto flex max-w-[860px] items-center gap-3 px-4 py-3">
            <Button
              type="button"
              variant="signara"
              onClick={handleContinue}
              disabled={continueDisabled}
            >
              {isRefreshingSteps ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Checking approvers…
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={emptyStepsWarningOpen} onOpenChange={setEmptyStepsWarningOpen}>
        <DialogContent className="border-signara-steel/30 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-signara-navy">Empty approval steps</DialogTitle>
            <DialogDescription className="text-signara-steel">
              {emptyApproverSteps.length === 1
                ? 'One approval step has no approver selected and will be skipped.'
                : `${emptyApproverSteps.length} approval steps have no approver selected and will be skipped.`}{' '}
              You can go back to assign someone, or continue and submit without those steps.
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm text-signara-navy">
            {emptyApproverSteps.map((step) => (
              <li key={step.workflowStepId}>
                Step {step.stepNumber}
                {step.policyLabel ? ` — ${step.policyLabel}` : ''}
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-signara-navy text-signara-navy"
              onClick={() => setEmptyStepsWarningOpen(false)}
            >
              Go back
            </Button>
            <Button
              type="button"
              variant="signara"
              disabled={isSubmitting}
              onClick={handleConfirmEmptySteps}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                'Continue anyway'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function StepIndicator({ currentIndex }: { currentIndex: number }) {
  return (
    <ol className="flex items-center">
      {WIZARD_STEPS.map((step, index) => {
        const isCompleted = index < currentIndex
        const isActive = index === currentIndex
        const isLast = index === WIZARD_STEPS.length - 1

        return (
          <li key={step.key} className={cn('flex items-center', !isLast && 'flex-1')}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                  isCompleted && 'bg-signara-gold text-signara-navy',
                  isActive && 'bg-signara-navy text-white ring-2 ring-signara-gold',
                  !isCompleted && !isActive && 'bg-signara-steel/30 text-signara-steel'
                )}
              >
                {isCompleted ? <Check className="size-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  'whitespace-nowrap text-xs font-medium',
                  isActive || isCompleted ? 'text-signara-navy' : 'text-signara-steel'
                )}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={cn(
                  'mx-2 h-0.5 flex-1',
                  index < currentIndex ? 'bg-signara-gold' : 'bg-signara-steel/30'
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
