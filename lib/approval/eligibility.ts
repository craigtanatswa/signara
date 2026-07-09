// ─── Approver eligibility & chain validation ────────────────────────────────
//
// A user is eligible to approve a workflow step when:
//   1. They are not the document initiator.
//   2. Their job level meets the step's minimum job level (or is more senior).
//   3. They are strictly more senior than the initiator.
//   4. They belong to the department the step's scope requires (if any).
//
// A full approval chain is valid when every step has an eligible approver
// assigned, no one appears twice, and seniority never decreases as the
// chain progresses (each step is approved by someone at least as senior
// as the previous approver).

import { userBelongsToDepartment } from '@/lib/org-structure/overseen-departments'
import { JOB_LEVEL_LABELS, JOB_LEVEL_RANK, type JobLevel } from '@/types/org-structure'
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
  return JOB_LEVEL_RANK[a] <= JOB_LEVEL_RANK[b]
}

/** True when `a` is strictly more senior than `b`. */
export function isRankMoreSenior(a: JobLevel, b: JobLevel): boolean {
  return JOB_LEVEL_RANK[a] < JOB_LEVEL_RANK[b]
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
  if (!isRankAtLeastAsSenior(approver.job_level, step.minJobLevel)) return false
  if (!isRankMoreSenior(approver.job_level, initiator.job_level)) return false

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
    return `${prefix}: No colleagues are assigned to ${scopeLabel} (${policyLabel}). Ask an admin to assign approvers to that department on the Team page.`
  }

  const seniorEnough = inScope.filter(
    (user) =>
      isRankAtLeastAsSenior(user.job_level, step.minJobLevel) &&
      isRankMoreSenior(user.job_level, initiator.job_level)
  )

  if (seniorEnough.length === 0) {
    return `${prefix}: ${inScope.length} colleague(s) in ${scopeLabel}, but none meet this step's requirements (${policyLabel}). You are ${JOB_LEVEL_LABELS[initiator.job_level]} — approvers must hold the minimum level and be more senior than you. Ask an admin to adjust job levels or the template.`
  }

  return `${prefix}: No eligible approver for you (${policyLabel}). Contact an admin to adjust this template or your organisation structure.`
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
}

/**
 * Validates and resolves the full approver chain chosen by the initiator at
 * document creation time. Re-checks eligibility server-side — never trust
 * assignments coming from the client without running this first.
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
  const usersById = new Map(users.map((u) => [u.id, u]))
  const assignmentsByStepId = new Map(assignments.map((a) => [a.workflowStepId, a.userId]))

  const activeSteps = workflow.steps.filter((step) => shouldIncludeWorkflowStep(step, formData))

  if (activeSteps.length === 0) {
    return {
      valid: false,
      errors: ['This template has no approval steps after applying conditions.'],
      resolvedSteps,
    }
  }

  let previousRank: number | null = null
  let stepOrder = 0
  const seenUserIds = new Set<string>()

  activeSteps.forEach((step, index) => {
    const position = `Step ${index + 1}`
    const userId = assignmentsByStepId.get(step.id)

    if (!userId) {
      errors.push(`${position} needs an approver selected.`)
      return
    }

    const approver = usersById.get(userId)
    if (!approver) {
      errors.push(`${position} approver is no longer in your organisation.`)
      return
    }

    if (!isEligibleApprover(approver, initiator, step)) {
      errors.push(`${approver.full_name} is not eligible to approve ${position.toLowerCase()}.`)
      return
    }

    if (seenUserIds.has(approver.id)) {
      errors.push(
        `${approver.full_name} is already assigned to another step. Choose a different approver for ${position.toLowerCase()}.`
      )
      return
    }

    const rank = JOB_LEVEL_RANK[approver.job_level]
    if (previousRank !== null && rank > previousRank) {
      errors.push(
        `${position}'s approver must be as senior as, or more senior than, the previous step's approver.`
      )
      return
    }

    seenUserIds.add(approver.id)
    previousRank = rank

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

  return {
    valid: errors.length === 0 && resolvedSteps.length === activeSteps.length,
    errors,
    resolvedSteps,
  }
}
