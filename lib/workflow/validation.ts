import type { DepartmentOption } from '@/types/org-structure'
import type { OrganisationUserOption, TemplateFieldOption, Workflow } from '@/types/workflow'
import { validateWorkflowAssigneeCoverage } from '@/lib/workflow/assignee-matching'

export const SELF_APPROVAL_NOTE =
  'Note: the person who initiates a document cannot also approve it at any step. Approver options follow this template’s department and minimum job-level settings, and are the same for every initiator in a given department.'

/**
 * Design-time validation only. Self-approval cannot be checked here because
 * the initiator differs per document instance — that check runs when a
 * document is created from this template.
 */
export function validateWorkflow(
  workflow: Workflow,
  signatureFields: TemplateFieldOption[],
  users: OrganisationUserOption[] = [],
  departments: DepartmentOption[] = []
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = []

  if (workflow.steps.length === 0 && signatureFields.length > 0) {
    warnings.push(
      'Approval steps are created automatically from approver signature fields. Reload this page if steps are missing.'
    )
  }

  const signatureFieldIds = new Set(signatureFields.map((field) => field.fieldId))
  const usedSignatureFieldIds = new Set<string>()

  workflow.steps.forEach((step, index) => {
    const position = `Step ${index + 1}`

    if (!step.signatureFieldId) {
      warnings.push(`${position} is not linked to a signature field yet.`)
    } else if (!signatureFieldIds.has(step.signatureFieldId)) {
      warnings.push(`${position} is linked to a signature field that no longer exists in the document.`)
    } else if (usedSignatureFieldIds.has(step.signatureFieldId)) {
      warnings.push(`${position} uses a signature field that's already linked to another step.`)
    } else {
      usedSignatureFieldIds.add(step.signatureFieldId)
    }

    if (step.departmentScope === 'fixed' && !step.assigneeDepartmentId) {
      warnings.push(`${position} needs a department selected.`)
    }

    if (!step.authorityText?.trim()) {
      warnings.push(`${position} is missing authority text describing what this approval means.`)
    }
  })

  const unlinkedFields = signatureFields.filter((field) => !usedSignatureFieldIds.has(field.fieldId))
  if (unlinkedFields.length > 0) {
    const plural = unlinkedFields.length > 1
    warnings.push(
      `${unlinkedFields.length} approver signature field${plural ? 's are' : ' is'} missing an approval step: ${unlinkedFields
        .map((field) => field.label)
        .join(', ')}. Reload the page — steps are created automatically from approver signature fields.`
    )
  }

  if (workflow.steps.length !== signatureFields.length && signatureFields.length > 0) {
    warnings.push(
      `Expected ${signatureFields.length} approval step${signatureFields.length === 1 ? '' : 's'} (one per approver signature field) but found ${workflow.steps.length}. Reload the page to sync.`
    )
  }

  warnings.push(...validateWorkflowAssigneeCoverage(workflow, users, departments))

  return { valid: warnings.length === 0, warnings }
}
