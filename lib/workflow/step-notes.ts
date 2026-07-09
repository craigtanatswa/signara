// ─── document_steps.notes JSON payload ──────────────────────────────────────
//
// `document_steps.notes` stores a small JSON blob describing the resolved
// policy for that step at the time the document was created, plus (if
// applicable) a rejection reason recorded when the step was rejected.

import type { JobLevel } from '@/types/org-structure'
import type { StepDepartmentScope } from '@/types/workflow'

export interface DocumentStepNotes {
  authorityText?: string
  deadlineHours?: number
  minJobLevel?: JobLevel
  departmentScope?: StepDepartmentScope
  resolvedDepartmentName?: string | null
  rejectionReason?: string
}

export function parseStepNotes(notes: string | null): DocumentStepNotes {
  if (!notes) return {}
  try {
    return JSON.parse(notes) as DocumentStepNotes
  } catch {
    return {}
  }
}

export function stringifyStepNotes(notes: DocumentStepNotes): string {
  return JSON.stringify(notes)
}
