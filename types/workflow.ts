// ─── Approval chain / workflow types ────────────────────────────────────────
//
// Workflow steps are policy-only: a template defines *who is allowed* to
// approve a step (minimum job level + department scope) and *which signature
// field* on the document that approval is tied to. The concrete approver is
// chosen by the initiator at document creation time from the eligible pool
// (see lib/approval/eligibility.ts) — templates never hard-code a person.

import type { JobLevel } from '@/types/org-structure'

/** Where the eligible approver pool is drawn from for a step. */
export type StepDepartmentScope = 'initiator' | 'fixed' | 'organisation'

export const INITIATOR_DEPARTMENT_LABEL = "Initiator's department"
export const ORGANISATION_WIDE_LABEL = 'Whole organisation'

/** Select value sentinels used in the step config UI */
export const INITIATOR_DEPARTMENT_SELECT_VALUE = '__initiator__'
export const ORGANISATION_WIDE_SELECT_VALUE = '__organisation__'

export type ConditionOperator = 'equals' | 'greater_than' | 'less_than'

export interface WorkflowCondition {
  fieldId: string
  operator: ConditionOperator
  value: string | number
}

export interface WorkflowStep {
  id: string
  stepIndex: number
  /** Signature field (from the template content) this approval step is tied to. */
  signatureFieldId?: string
  /** Approver must be at this job level or more senior. */
  minJobLevel: JobLevel
  departmentScope: StepDepartmentScope
  /** Only used when departmentScope === 'fixed'. */
  assigneeDepartmentId?: string
  authorityText: string
  deadlineHours: number
  allowDelegate: boolean
  condition?: WorkflowCondition

  // ─── Legacy fields (pre hybrid-approval-workflow) ───────────────────────
  // Kept optional so `normaliseWorkflowStep` can migrate old templates on
  // read. New code should never write these.
  /** @deprecated */
  assigneeType?: 'user' | 'department_role' | 'role'
  /** @deprecated */
  assigneeUserId?: string
  /** @deprecated use minJobLevel */
  assigneeJobLevel?: JobLevel
  /** @deprecated free-text role, superseded by department + job level */
  assigneeRole?: string
}

export interface Workflow {
  steps: WorkflowStep[]
}

export const DEFAULT_DEADLINE_HOURS = 48

export const DEADLINE_HOUR_OPTIONS: { label: string; value: number }[] = [
  { label: '24 hours', value: 24 },
  { label: '48 hours', value: 48 },
  { label: '72 hours', value: 72 },
  { label: '5 days', value: 120 },
  { label: '7 days', value: 168 },
]

export const CONDITION_OPERATOR_OPTIONS: { label: string; value: ConditionOperator }[] = [
  { label: 'is equal to', value: 'equals' },
  { label: 'is greater than', value: 'greater_than' },
  { label: 'is less than', value: 'less_than' },
]

function isStepDepartmentScope(value: unknown): value is StepDepartmentScope {
  return value === 'initiator' || value === 'fixed' || value === 'organisation'
}

/**
 * Migrates a legacy workflow step (fixed-user or exact department+level match)
 * into the policy-only shape. Safe to call on already-migrated steps.
 */
export function normaliseWorkflowStep(step: WorkflowStep): WorkflowStep {
  const alreadyMigrated = step.minJobLevel !== undefined && isStepDepartmentScope(step.departmentScope)

  if (alreadyMigrated) {
    return {
      id: step.id,
      stepIndex: step.stepIndex,
      signatureFieldId: step.signatureFieldId,
      minJobLevel: step.minJobLevel,
      departmentScope: step.departmentScope,
      assigneeDepartmentId:
        step.departmentScope === 'fixed' ? step.assigneeDepartmentId : undefined,
      authorityText: step.authorityText ?? '',
      deadlineHours: step.deadlineHours ?? DEFAULT_DEADLINE_HOURS,
      allowDelegate: step.allowDelegate ?? false,
      condition: step.condition,
    }
  }

  const legacyType = step.assigneeType === 'role' ? 'department_role' : step.assigneeType

  let departmentScope: StepDepartmentScope
  let minJobLevel: JobLevel
  let assigneeDepartmentId: string | undefined

  if (legacyType === 'user') {
    // Fixed-person steps had no seniority policy attached. Fall back to an
    // organisation-wide, no-floor policy — the "more senior than initiator"
    // rule still applies at runtime. Admins should review these steps.
    departmentScope = 'organisation'
    minJobLevel = 'staff'
  } else if (step.departmentScope === 'initiator') {
    departmentScope = 'initiator'
    minJobLevel = step.assigneeJobLevel ?? 'manager'
  } else if (step.assigneeDepartmentId) {
    departmentScope = 'fixed'
    minJobLevel = step.assigneeJobLevel ?? 'manager'
    assigneeDepartmentId = step.assigneeDepartmentId
  } else {
    departmentScope = 'organisation'
    minJobLevel = step.assigneeJobLevel ?? 'manager'
  }

  return {
    id: step.id,
    stepIndex: step.stepIndex,
    signatureFieldId: step.signatureFieldId,
    minJobLevel,
    departmentScope,
    assigneeDepartmentId,
    authorityText: step.authorityText ?? '',
    deadlineHours: step.deadlineHours ?? DEFAULT_DEADLINE_HOURS,
    allowDelegate: step.allowDelegate ?? false,
    condition: step.condition,
  }
}

export function normaliseWorkflow(workflow: Workflow): Workflow {
  return {
    steps: (workflow?.steps ?? []).map(normaliseWorkflowStep),
  }
}

export function createWorkflowStep(
  stepIndex: number,
  overrides?: Partial<WorkflowStep>
): WorkflowStep {
  return {
    id: crypto.randomUUID(),
    stepIndex,
    minJobLevel: 'manager',
    departmentScope: 'initiator',
    authorityText: '',
    deadlineHours: DEFAULT_DEADLINE_HOURS,
    allowDelegate: false,
    ...overrides,
  }
}

export function createDefaultWorkflow(defaults?: {
  departmentId?: string
  jobLevel?: JobLevel
}): Workflow {
  return {
    steps: [
      createWorkflowStep(0, {
        departmentScope: defaults?.departmentId ? 'fixed' : 'initiator',
        assigneeDepartmentId: defaults?.departmentId,
        minJobLevel: defaults?.jobLevel ?? 'manager',
      }),
    ],
  }
}

export function reindexSteps(steps: WorkflowStep[]): WorkflowStep[] {
  return steps.map((step, index) => ({ ...step, stepIndex: index }))
}

export interface OrganisationUserOption {
  id: string
  full_name: string
  email: string
  department_id: string | null
  department_name: string | null
  job_level: JobLevel
  /** Additional departments this user approves for (director/manager). MD uses all depts implicitly. */
  overseen_department_ids?: string[]
}

export interface TemplateFieldOption {
  fieldId: string
  label: string
}

export interface FormatStepPolicyLabelOptions {
  /** When set, initiator-scoped steps show this department name instead of the generic label. */
  initiatorDepartmentId?: string | null
}

/** Human-readable summary of a step's approver policy, e.g. "Finance · Manager or above". */
export function formatStepPolicyLabel(
  step: Pick<WorkflowStep, 'departmentScope' | 'assigneeDepartmentId' | 'minJobLevel'>,
  departmentsById: Map<string, { name: string }>,
  getLabel: (level: JobLevel) => string,
  options?: FormatStepPolicyLabelOptions
): string {
  const levelLabel = `${getLabel(step.minJobLevel)} or above`

  if (step.departmentScope === 'initiator') {
    const initiatorDept =
      options?.initiatorDepartmentId != null
        ? departmentsById.get(options.initiatorDepartmentId)
        : undefined
    const departmentLabel = initiatorDept?.name ?? INITIATOR_DEPARTMENT_LABEL
    return `${departmentLabel} · ${levelLabel}`
  }

  if (step.departmentScope === 'organisation') {
    return `${ORGANISATION_WIDE_LABEL} · ${levelLabel}`
  }

  const dept = step.assigneeDepartmentId ? departmentsById.get(step.assigneeDepartmentId) : undefined
  return dept ? `${dept.name} · ${levelLabel}` : `Select department · ${levelLabel}`
}
