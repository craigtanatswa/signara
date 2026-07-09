'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Info, Loader2, Minimize2, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { BackLink } from '@/components/layout/back-link'
import { WorkflowCanvas } from '@/components/workflow/workflow-canvas'
import { StepConfigPanel } from '@/components/workflow/step-config-panel'
import { updateTemplateWorkflow } from '@/app/actions/templates'
import { SELF_APPROVAL_NOTE, validateWorkflow } from '@/lib/workflow/validation'
import {
  areStepsSyncedWithSignatures,
  syncWorkflowStepsWithSignatures,
} from '@/lib/workflow/signature-fields'
import { useDepartments } from '@/hooks/use-departments'
import type { OrganisationUserOption, TemplateFieldOption, Workflow, WorkflowStep } from '@/types/workflow'

interface WorkflowBuilderClientProps {
  templateId: string
  templateName: string
  initialWorkflow: Workflow
  templateFields: TemplateFieldOption[]
  signatureFields: TemplateFieldOption[]
}

interface WorkflowToolbarProps {
  onSaveWorkflow: () => void
  isSaving: boolean
  onMinimize?: () => void
}

function WorkflowToolbar({ onSaveWorkflow, isSaving, onMinimize }: WorkflowToolbarProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      {onMinimize && (
        <Button
          type="button"
          variant="outline"
          onClick={onMinimize}
          className="border-signara-steel text-signara-navy hover:bg-signara-background"
        >
          <Minimize2 className="mr-1.5 size-4" />
          Exit full screen
        </Button>
      )}
      <Button onClick={onSaveWorkflow} disabled={isSaving} variant="signara">
        {isSaving ? (
          <>
            <Loader2 className="mr-1.5 size-4 animate-spin" />
            Saving…
          </>
        ) : (
          'Save workflow'
        )}
      </Button>
    </div>
  )
}

export function WorkflowBuilderClient({
  templateId,
  templateName,
  initialWorkflow,
  templateFields,
  signatureFields,
}: WorkflowBuilderClientProps) {
  const [steps, setSteps] = useState<WorkflowStep[]>(initialWorkflow.steps)
  const [users, setUsers] = useState<OrganisationUserOption[]>([])
  const { departments, loading: departmentsLoading } = useDepartments()
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)

  const signatureFieldKey = signatureFields.map((field) => field.fieldId).join('|')

  useEffect(() => {
    setSteps((prev) => {
      const synced = syncWorkflowStepsWithSignatures(prev, signatureFields)
      return areStepsSyncedWithSignatures(prev, signatureFields) ? prev : synced
    })
  }, [signatureFieldKey, signatureFields])

  useEffect(() => {
    let cancelled = false

    fetch('/api/users/list')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setUsers(data.users ?? [])
      })
      .catch(() => {
        // Coverage warnings are best-effort; failing to load users shouldn't block editing.
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isMaximized) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMaximized(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isMaximized])

  const selectedStep = steps.find((step) => step.id === selectedStepId) ?? null
  const selectedStepNumber = steps.findIndex((step) => step.id === selectedStepId) + 1

  const { warnings: workflowWarnings } = useMemo(
    () => validateWorkflow({ steps }, signatureFields, users, departments),
    [steps, signatureFields, users, departments]
  )

  const handleEditStep = useCallback((stepId: string) => {
    setSelectedStepId(stepId)
    setPanelOpen(true)
  }, [])

  function handleSaveStep(updated: WorkflowStep) {
    setSteps((prev) => prev.map((step) => (step.id === updated.id ? updated : step)))
    setPanelOpen(false)
  }

  async function handleSaveWorkflow() {
    const syncedSteps = syncWorkflowStepsWithSignatures(steps, signatureFields)
    if (!areStepsSyncedWithSignatures(steps, signatureFields)) {
      setSteps(syncedSteps)
    }

    setIsSaving(true)
    const result = await updateTemplateWorkflow(templateId, { steps: syncedSteps })
    setIsSaving(false)

    if (result?.error) {
      toast.error(result.error)
      return
    }

    toast.success('Approval chain saved')
  }

  const canvasProps = {
    steps,
    departments,
    signatureFields,
    onEditStep: handleEditStep,
    lockedToSignatures: true,
  }

  const stepSummary =
    signatureFields.length === 0
      ? null
      : signatureFields.length === 1
        ? '1 approval step (one per approver signature field)'
        : `${signatureFields.length} approval steps (one per approver signature field)`

  return (
    <>
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-signara-steel/25 bg-white shadow-sm">
          <div className="border-b border-signara-steel/10 px-6 py-1">
            <BackLink href={`/dashboard/templates/${templateId}/edit`} label="Back to editor" />
          </div>

          <div className="flex items-center justify-between gap-4 px-6 py-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-signara-navy">{templateName}</h2>
              <p className="text-sm text-signara-steel">
                Approval chain{stepSummary ? ` · ${stepSummary}` : ''}
              </p>
            </div>

            <WorkflowToolbar onSaveWorkflow={handleSaveWorkflow} isSaving={isSaving} />
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto bg-signara-background p-6">
          {signatureFields.length === 0 && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-800">
              <TriangleAlert />
              <AlertDescription className="text-amber-800">
                Add at least one signature field to the document (in the template editor) before
                building the approval chain.
              </AlertDescription>
            </Alert>
          )}

          {workflowWarnings.length > 0 && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-800">
              <TriangleAlert />
              <AlertDescription className="text-amber-800">
                <ul className="list-inside list-disc space-y-1">
                  {workflowWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <Alert className="border-signara-navy/20 bg-signara-navy/5 text-signara-navy">
            <Info />
            <AlertDescription className="text-signara-navy/90">{SELF_APPROVAL_NOTE}</AlertDescription>
          </Alert>

          {signatureFields.length > 0 && (
            <div className="text-sm text-signara-steel">
              Approval steps are created automatically — one for each approver signature field in your document,
              in the same order. Initiator signatures are configured separately in the template editor.
              Click a step to configure who can approve and what the approval means.
            </div>
          )}

          <WorkflowCanvas {...canvasProps} onMaximize={() => setIsMaximized(true)} />

          <div className="text-center text-xs text-signara-steel">
            Scroll to zoom and pan the canvas. Use the controls in the bottom-left corner if needed.
          </div>
        </div>
      </div>

      {isMaximized && (
        <div className="fixed inset-0 z-40 flex flex-col bg-signara-background">
          <header className="shrink-0 border-b border-signara-steel/25 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-4 px-6 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-signara-navy">{templateName}</h2>
                <p className="text-sm text-signara-steel">Approval chain — full screen</p>
              </div>
              <WorkflowToolbar
                onSaveWorkflow={handleSaveWorkflow}
                isSaving={isSaving}
                onMinimize={() => setIsMaximized(false)}
              />
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
            <p className="shrink-0 text-sm text-signara-steel">
              Click a step to configure it. Press{' '}
              <kbd className="rounded border border-signara-steel/40 bg-white px-1.5 py-0.5 text-xs">Esc</kbd> to
              exit full screen.
            </p>
            <WorkflowCanvas {...canvasProps} className="min-h-0 flex-1" />
          </div>
        </div>
      )}

      <StepConfigPanel
        key={selectedStep?.id ?? 'none'}
        step={selectedStep}
        stepNumber={selectedStepNumber}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        departments={departments}
        departmentsLoading={departmentsLoading}
        templateFields={templateFields}
        signatureFields={signatureFields}
        onSave={handleSaveStep}
      />
    </>
  )
}
