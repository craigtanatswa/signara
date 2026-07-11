// ─── Approver eligibility & chain validation ────────────────────────────────
//
// A user is eligible to approve a workflow step when:
//   1. They are not the document initiator.
//   2. Their job level meets the step's minimum job level (or is more senior).
//   3. They belong to the department the step's scope requires (if any).
//
// Eligible pools are the same for every initiator in a given department —
// initiator seniority does not shrink or expand the options. The initiator
// chooses who approves from that pool.
//
// Empty assignments are allowed: those steps are skipped. At least one
// approver must still be assigned. Each step is validated only against its
// own admin-set minimum job level and department scope.

import { userBelongsToDepartment } from '@/lib/org-structure/overseen-departments'
import { formatUserDisplayName } from '@/lib/users/display-name'
import { meetsStepMinimumJobLevel, type JobLevel } from '@/types/org-structure'
import type { TemplateScope } from '@/types/database'
import type { OrganisationUserOption, Workflow, WorkflowStep } from '@/types/workflow'
import { shouldIncludeWorkflowStep } from '@/lib/workflow/resolve-steps'

export interface EligibilityInitiator {
  id: string
  department_id: string | null
  job_level: JobLevel
}

export interface EligibilityTemplate {
  scope: TemplateScope
  department_id: string | null
}

/** True when `a` is more senior than, or as senior as, `b` (lower rank number = more senior). */
export function isRankAtLeastAsSenior(a: JobLevel, b: JobLevel): boolean {
  return meetsStepMinimumJobLevel(a, b)
}

/** Can this user initiate a document from this template? Org templates: anyone. Dept templates: members of that department only. */
export function canInitiateTemplate(
  template: EligibilityTemplate,
  initiator: Pick<EligibilityInitiator, 'department_id'>
): boolean {
  if (template.scope === 'organisation') return true
  return template.department_id !== null && initiator.department_id === template.department_id
}

export function isEligibleApprover(
  approver: OrganisationUserOption,
  initiator: EligibilityInitiator,
  step: WorkflowStep
): boolean {
  if (approver.id === initiator.id) return false
  if (!meetsStepMinimumJobLevel(approver.job_level, step.minJobLevel)) return false

  if (step.departmentScope === 'initiator') {
    return (
      Boolean(initiator.department_id) &&
      userBelongsToDepartment(approver, initiator.department_id)
    )
  }

  if (step.departmentScope === 'fixed') {
    return (
      Boolean(step.assigneeDepartmentId) &&
      userBelongsToDepartment(approver, step.assigneeDepartmentId)
    )
  }

  return true // 'organisation' scope — any department is eligible
}

/** Eligible approvers for a step, sorted alphabetically for display in a picker. */
export function getEligibleApprovers(
  step: WorkflowStep,
  initiator: EligibilityInitiator,
  users: OrganisationUserOption[]
): OrganisationUserOption[] {
  return users
    .filter((user) => isEligibleApprover(user, initiator, step))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
}

function usersMatchingStepDepartment(
  step: WorkflowStep,
  initiator: EligibilityInitiator,
  users: OrganisationUserOption[]
): OrganisationUserOption[] {
  return users.filter((user) => {
    if (user.id === initiator.id) return false
    if (step.departmentScope === 'initiator') {
      return Boolean(initiator.department_id) && userBelongsToDepartment(user, initiator.department_id)
    }
    if (step.departmentScope === 'fixed') {
      return Boolean(step.assigneeDepartmentId) && userBelongsToDepartment(user, step.assigneeDepartmentId)
    }
    return true
  })
}

/** Explains why a step has no eligible approvers for the current initiator. */
export function buildStepApproverShortageMessage(input: {
  stepNumber: number
  step: WorkflowStep
  initiator: EligibilityInitiator
  users: OrganisationUserOption[]
  departmentName?: string | null
  policyLabel: string
}): string {
  const { stepNumber, step, initiator, users, departmentName, policyLabel } = input
  const prefix = `Step ${stepNumber}`

  if (users.length <= 1) {
    return `${prefix}: Could not load other members of your organisation to check approver availability. Please try again, or contact support if this persists.`
  }

  const inScope = usersMatchingStepDepartment(step, initiator, users)
  const scopeLabel =
    step.departmentScope === 'organisation'
      ? 'your organisation'
      : departmentName ?? 'the required department'

  if (step.departmentScope === 'initiator' && !initiator.department_id) {
    return `${prefix}: Your account is not assigned to a department. Ask an admin to set your department on the Team page.`
  }

  if (inScope.length === 0) {
    return `${prefix}: No colleagues are assigned to ${scopeLabel} (${policyLabel}). You can leave this step empty to skip it, or ask an admin to assign people to that department on the Team page.`
  }

  const seniorEnough = inScope.filter((user) =>
    meetsStepMinimumJobLevel(user.job_level, step.minJobLevel)
  )

  if (seniorEnough.length === 0) {
    return `${prefix}: ${inScope.length} colleague(s) in ${scopeLabel}, but none meet this step's minimum level (${policyLabel}). You can leave this step empty to skip it, or ask an admin to adjust job levels or the template.`
  }

  return `${prefix}: No eligible approver available (${policyLabel}). You can leave this step empty to skip it, or contact an admin.`
}

export interface ChainAssignment {
  workflowStepId: string
  userId: string
}

export interface ResolvedApprovalStep {
  workflowStepId: string
  stepOrder: number
  assigneeUserId: string
  signatureFieldId: string | null
  authorityText: string
  deadlineHours: number
  minJobLevel: JobLevel
  departmentScope: WorkflowStep['departmentScope']
  assigneeDepartmentId?: string
}

export interface ChainValidationResult {
  valid: boolean
  errors: string[]
  resolvedSteps: ResolvedApprovalStep[]
  skippedStepIds: string[]
}

/**
 * Validates and resolves the full approver chain chosen by the initiator at
 * document creation time. Re-checks eligibility server-side — never trust
 * assignments coming from the client without running this first.
 *
 * Steps left without an assignee are skipped. At least one assigned step is
 * required.
 */
export function validateApprovalChain(input: {
  workflow: Workflow
  initiator: EligibilityInitiator
  assignments: ChainAssignment[]
  users: OrganisationUserOption[]
  formData?: Record<string, unknown>
}): ChainValidationResult {
  const { workflow, initiator, assignments, users } = input
  const formData = input.formData ?? {}
  const errors: string[] = []
  const resolvedSteps: ResolvedApprovalStep[] = []
  const skippedStepIds: string[] = []
  const usersById = new Map(users.map((u) => [u.id, u]))
  const assignmentsByStepId = new Map(
    assignments
      .filter((a) => Boolean(a.userId))
      .map((a) => [a.workflowStepId, a.userId])
  )

  const activeSteps = workflow.steps.filter((step) => shouldIncludeWorkflowStep(step, formData))

  if (activeSteps.length === 0) {
    return {
      valid: false,
      errors: ['This template has no approval steps after applying conditions.'],
      resolvedSteps,
      skippedStepIds,
    }
  }

  let stepOrder = 0
  const seenUserIds = new Set<string>()

  activeSteps.forEach((step, index) => {
    const position = `Step ${index + 1}`
    const userId = assignmentsByStepId.get(step.id)

    if (!userId) {
      skippedStepIds.push(step.id)
      return
    }

    const approver = usersById.get(userId)
    if (!approver) {
      errors.push(`${position} approver is no longer in your organisation.`)
      return
    }

    if (!isEligibleApprover(approver, initiator, step)) {
      errors.push(
        `${formatUserDisplayName(approver.full_name, approver.position)} is not eligible to approve ${position.toLowerCase()}.`
      )
      return
    }

    if (seenUserIds.has(approver.id)) {
      errors.push(
        `${formatUserDisplayName(approver.full_name, approver.position)} is already assigned to another step. Choose a different approver for ${position.toLowerCase()}.`
      )
      return
    }

    seenUserIds.add(approver.id)

    resolvedSteps.push({
      workflowStepId: step.id,
      stepOrder,
      assigneeUserId: approver.id,
      signatureFieldId: step.signatureFieldId ?? null,
      authorityText: step.authorityText?.trim() ?? '',
      deadlineHours: step.deadlineHours,
      minJobLevel: step.minJobLevel,
      departmentScope: step.departmentScope,
      assigneeDepartmentId: step.assigneeDepartmentId,
    })
    stepOrder += 1
  })

  if (errors.length === 0 && resolvedSteps.length === 0) {
    errors.push('Select at least one approver. Empty steps are skipped, but the document needs someone to approve it.')
  }

  return {
    valid: errors.length === 0 && resolvedSteps.length > 0,
    errors,
    resolvedSteps,
    skippedStepIds,
  }
}
