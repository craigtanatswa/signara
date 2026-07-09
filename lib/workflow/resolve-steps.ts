import type { JobLevel } from '@/types/org-structure'
import type { WorkflowCondition, WorkflowStep } from '@/types/workflow'

/** The user initiating a document — used for 'initiator' department scope and seniority checks. */
export interface DocumentInitiator {
  id: string
  organisation_id: string
  department_id: string | null
  job_level: JobLevel
  full_name: string
}

export function evaluateWorkflowCondition(
  condition: WorkflowCondition,
  formData: Record<string, unknown>
): boolean {
  const raw = formData[condition.fieldId]
  if (raw === undefined || raw === null) return false

  const expected = condition.value
  const numericRaw = typeof raw === 'number' ? raw : Number(raw)
  const numericExpected = typeof expected === 'number' ? expected : Number(expected)

  switch (condition.operator) {
    case 'equals':
      return String(raw).trim() === String(expected).trim()
    case 'greater_than':
      return !Number.isNaN(numericRaw) && !Number.isNaN(numericExpected) && numericRaw > numericExpected
    case 'less_than':
      return !Number.isNaN(numericRaw) && !Number.isNaN(numericExpected) && numericRaw < numericExpected
    default:
      return false
  }
}

export function shouldIncludeWorkflowStep(
  step: WorkflowStep,
  formData: Record<string, unknown>
): boolean {
  if (!step.condition) return true
  return evaluateWorkflowCondition(step.condition, formData)
}
