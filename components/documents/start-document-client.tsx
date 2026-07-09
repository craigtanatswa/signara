'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, PlayCircle, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { createDocumentFromTemplate } from '@/app/actions/documents'
import type { InitiationStepInfo } from '@/app/actions/documents'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ErrorMessage } from '@/components/ui/error-message'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface StartDocumentClientProps {
  templateId: string
  templateName: string
  steps: InitiationStepInfo[]
  blockingError?: string
}

export function StartDocumentClient({
  templateId,
  templateName,
  steps,
  blockingError,
}: StartDocumentClientProps) {
  const router = useRouter()
  const [title, setTitle] = useState(`${templateName} — ${new Date().toLocaleDateString('en-GB')}`)
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const usedApproverIds = useMemo(() => new Set(Object.values(assignments)), [assignments])

  const allStepsAssigned = steps.every((step) => Boolean(assignments[step.workflowStepId]))
  const canSubmit = !blockingError && allStepsAssigned && title.trim().length > 0

  function handleAssigneeChange(workflowStepId: string, userId: string) {
    setAssignments((prev) => ({ ...prev, [workflowStepId]: userId }))
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setServerError(null)

    startTransition(async () => {
      const result = await createDocumentFromTemplate({
        templateId,
        title,
        data: {},
        assignments: steps.map((step) => ({
          workflowStepId: step.workflowStepId,
          userId: assignments[step.workflowStepId],
        })),
      })

      if (result.error) {
        setServerError(result.error)
        return
      }

      toast.success('Draft created — finish and submit when ready')
      router.push(`/dashboard/documents/${result.documentId}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {blockingError && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-800">
          <TriangleAlert />
          <AlertDescription className="text-amber-800">{blockingError}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border border-signara-steel/30 bg-white p-6 shadow-sm">
        <div className="space-y-1.5">
          <Label htmlFor="document-title" className="text-signara-navy font-medium">
            Document title
          </Label>
          <Input
            id="document-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="border-signara-steel focus-visible:ring-signara-navy"
            required
          />
        </div>
      </div>

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
                    onValueChange={(value) => handleAssigneeChange(step.workflowStepId, value)}
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

      {serverError && <ErrorMessage>{serverError}</ErrorMessage>}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="signara" disabled={isPending || !canSubmit}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
            Submitting…
            </>
          ) : (
            <>
              <PlayCircle className="mr-2 size-4" />
              Create draft
            </>
          )}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/documents/new">Back</Link>
        </Button>
      </div>
    </form>
  )
}
