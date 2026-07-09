// ─── Linking workflow steps to signature fields in the template content ────

import {
  assignDefaultSignatureRoles,
  listTemplateFields,
} from '@/lib/tiptap/field-utils'
import { createWorkflowStep, reindexSteps } from '@/types/workflow'
import type { FormFieldAttrs, TiptapDocument } from '@/types/database'
import type { TemplateFieldOption, WorkflowStep } from '@/types/workflow'

function toFieldOption(field: FormFieldAttrs): TemplateFieldOption {
  const label =
    field.signatureRole === 'initiator' ? `${field.label} (Initiator)` : field.label
  return { fieldId: field.fieldId, label }
}

function listSignatureFields(content: TiptapDocument | null): FormFieldAttrs[] {
  return assignDefaultSignatureRoles(listTemplateFields(content)).filter(
    (field) => field.fieldType === 'signature'
  )
}

/** All signature fields placed in the template document, in document order. */
export function listSignatureFieldOptions(content: TiptapDocument | null): TemplateFieldOption[] {
  return listSignatureFields(content).map(toFieldOption)
}

/** Approver signatures only — these drive the approval chain. */
export function listApproverSignatureFieldOptions(
  content: TiptapDocument | null
): TemplateFieldOption[] {
  return listSignatureFields(content)
    .filter((field) => field.signatureRole !== 'initiator')
    .map(toFieldOption)
}

/** Initiator signature field for this template, if configured. */
export function getInitiatorSignatureField(
  content: TiptapDocument | null
): FormFieldAttrs | null {
  return (
    listSignatureFields(content).find((field) => field.signatureRole === 'initiator') ?? null
  )
}

export function templateHasInitiatorSignature(content: TiptapDocument | null): boolean {
  return getInitiatorSignatureField(content) !== null
}

/** Signature fields not already claimed by another step (optionally excluding one step, e.g. the one being edited). */
export function getAvailableSignatureFields(
  signatureFields: TemplateFieldOption[],
  steps: WorkflowStep[],
  excludeStepId?: string
): TemplateFieldOption[] {
  const usedFieldIds = new Set(
    steps
      .filter((step) => step.id !== excludeStepId && step.signatureFieldId)
      .map((step) => step.signatureFieldId)
  )
  return signatureFields.filter((field) => !usedFieldIds.has(field.fieldId))
}

export function getSignatureFieldLabel(
  fieldId: string | undefined,
  signatureFields: TemplateFieldOption[]
): string | undefined {
  if (!fieldId) return undefined
  return signatureFields.find((field) => field.fieldId === fieldId)?.label
}

/** Next signature field not yet linked to any workflow step. */
export function pickNextSignatureField(
  signatureFields: TemplateFieldOption[],
  steps: WorkflowStep[]
): TemplateFieldOption | undefined {
  return getAvailableSignatureFields(signatureFields, steps)[0]
}

export function countUnlinkedSignatureFields(
  signatureFields: TemplateFieldOption[],
  steps: WorkflowStep[]
): number {
  return getAvailableSignatureFields(signatureFields, steps).length
}

/** Append steps (or assign existing unlinked steps) until every signature field has its own step. */
export function createStepsForUnlinkedSignatures(
  existingSteps: WorkflowStep[],
  signatureFields: TemplateFieldOption[]
): WorkflowStep[] {
  return syncWorkflowStepsWithSignatures(existingSteps, signatureFields)
}

/**
 * Keep exactly one approval step per approver signature field (document order).
 * Preserves existing step configuration when the signature link still matches;
 * reuses orphan steps when new signatures are added; creates empty steps awaiting config.
 */
export function syncWorkflowStepsWithSignatures(
  existingSteps: WorkflowStep[],
  signatureFields: TemplateFieldOption[]
): WorkflowStep[] {
  if (signatureFields.length === 0) return []

  const bySignatureId = new Map<string, WorkflowStep>()
  for (const step of existingSteps) {
    if (
      step.signatureFieldId &&
      signatureFields.some((field) => field.fieldId === step.signatureFieldId) &&
      !bySignatureId.has(step.signatureFieldId)
    ) {
      bySignatureId.set(step.signatureFieldId, step)
    }
  }

  const orphans = existingSteps.filter((step) => {
    if (!step.signatureFieldId) return true
    return !bySignatureId.has(step.signatureFieldId) || bySignatureId.get(step.signatureFieldId)?.id !== step.id
  })

  let orphanIndex = 0

  return reindexSteps(
    signatureFields.map((field, index) => {
      const matched = bySignatureId.get(field.fieldId)
      if (matched) {
        return { ...matched, stepIndex: index, signatureFieldId: field.fieldId }
      }

      if (orphanIndex < orphans.length) {
        const orphan = orphans[orphanIndex++]
        return { ...orphan, stepIndex: index, signatureFieldId: field.fieldId }
      }

      return createWorkflowStep(index, { signatureFieldId: field.fieldId })
    })
  )
}

export function areStepsSyncedWithSignatures(
  steps: WorkflowStep[],
  signatureFields: TemplateFieldOption[]
): boolean {
  if (steps.length !== signatureFields.length) return false
  return signatureFields.every((field, index) => steps[index]?.signatureFieldId === field.fieldId)
}
