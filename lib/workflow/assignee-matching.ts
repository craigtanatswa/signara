// ─── Design-time coverage checks ────────────────────────────────────────────
//
// These warn admins when a step's policy could never be satisfied by anyone
// currently in the organisation. This is a heuristic check only — the actual
// eligible pool for a given document also depends on department scope relative
// to the initiator (see lib/approval/eligibility.ts), which isn't fully known
// at template design time.

import { userBelongsToDepartment } from '@/lib/org-structure/overseen-departments'
import { JOB_LEVEL_LABELS, meetsStepMinimumJobLevel, type DepartmentOption, type JobLevel } from '@/types/org-structure'
import type { OrganisationUserOption, Workflow, WorkflowStep } from '@/types/workflow'

export function countPotentialAssignees(
  step: WorkflowStep,
  users: OrganisationUserOption[]
): number {
  return users.filter((user) => {
    if (!meetsStepMinimumJobLevel(user.job_level, step.minJobLevel)) return false
    if (step.departmentScope === 'fixed') {
      return userBelongsToDepartment(user, step.assigneeDepartmentId)
    }
    // 'initiator' and 'organisation' scopes depend on the initiator at
    // runtime — at design time we only check whether anyone in the org
    // holds a sufficiently senior level at all.
    return true
  }).length
}

export function validateWorkflowAssigneeCoverage(
  workflow: Workflow,
  users: OrganisationUserOption[],
  departments: DepartmentOption[]
): string[] {
  const warnings: string[] = []
  const departmentsById = new Map(departments.map((d) => [d.id, d]))

  workflow.steps.forEach((step, index) => {
    const position = `Step ${index + 1}`

    if (step.departmentScope === 'fixed' && !step.assigneeDepartmentId) {
      warnings.push(`${position} needs a department selected.`)
      return
    }

    // Initiator department is unknown until someone starts a document — skip at design time.
    if (step.departmentScope === 'initiator') {
      return
    }

    // Can't assess coverage without org member data (still loading or fetch failed).
    if (users.length === 0) {
      return
    }

    const count = countPotentialAssignees(step, users)
    if (count === 0) {
      const scopeLabel =
        step.departmentScope === 'fixed'
          ? (departmentsById.get(step.assigneeDepartmentId ?? '')?.name ?? 'the selected department')
          : 'your organisation'
      warnings.push(
        `${position} has no one in ${scopeLabel} at ${JOB_LEVEL_LABELS[step.minJobLevel]} or above yet.`
      )
    }
  })

  return warnings
}
