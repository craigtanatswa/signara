import type { DepartmentOption, JobLevel } from '@/types/org-structure'

/** Job levels that may have explicitly assigned overseen departments. */
export const OVERSEEN_JOB_LEVELS: JobLevel[] = ['director', 'manager']

export function canHaveExplicitOverseenDepartments(jobLevel: JobLevel): boolean {
  return OVERSEEN_JOB_LEVELS.includes(jobLevel)
}

export function managingDirectorOverseesAllDepartments(jobLevel: JobLevel): boolean {
  return jobLevel === 'managing_director'
}

export interface DepartmentMembershipUser {
  department_id: string | null
  job_level: JobLevel
  overseen_department_ids?: string[]
  overseen_departments?: { id: string }[]
}

function getOverseenDepartmentIds(user: DepartmentMembershipUser): string[] {
  if (user.overseen_department_ids?.length) {
    return user.overseen_department_ids
  }
  return user.overseen_departments?.map((d) => d.id) ?? []
}

/** Whether a user belongs to a department for approval routing purposes. */
export function userBelongsToDepartment(
  user: DepartmentMembershipUser,
  departmentId: string | null | undefined
): boolean {
  if (!departmentId) return false
  if (managingDirectorOverseesAllDepartments(user.job_level)) return true
  if (user.department_id === departmentId) return true
  return getOverseenDepartmentIds(user).includes(departmentId)
}

/** Primary + explicitly overseen departments — used for team page display/filtering only. */
export function memberVisibleInDepartment(
  member: DepartmentMembershipUser,
  departmentId: string
): boolean {
  if (member.department_id === departmentId) return true
  return getOverseenDepartmentIds(member).includes(departmentId)
}

export function getVisibleMemberDepartmentIds(member: DepartmentMembershipUser): string[] {
  const ids = new Set<string>()
  if (member.department_id) {
    ids.add(member.department_id)
  }
  getOverseenDepartmentIds(member).forEach((id) => ids.add(id))
  return [...ids]
}

export function validateOverseenDepartments(input: {
  jobLevel: JobLevel
  primaryDepartmentId: string
  overseenDepartmentIds: string[]
  departments: DepartmentOption[]
}): string | null {
  const { jobLevel, primaryDepartmentId, overseenDepartmentIds, departments } = input
  const departmentIds = new Set(departments.map((d) => d.id))

  if (managingDirectorOverseesAllDepartments(jobLevel)) {
    if (overseenDepartmentIds.length > 0) {
      return 'Managing Director automatically oversees all departments.'
    }
    return null
  }

  if (!canHaveExplicitOverseenDepartments(jobLevel)) {
    if (overseenDepartmentIds.length > 0) {
      return 'Only Directors and Managers can oversee additional departments.'
    }
    return null
  }

  if (!departmentIds.has(primaryDepartmentId)) {
    return 'Select a valid primary department.'
  }

  const uniqueIds = [...new Set(overseenDepartmentIds)]
  for (const deptId of uniqueIds) {
    if (!departmentIds.has(deptId)) {
      return 'One or more overseen departments are invalid.'
    }
    if (deptId === primaryDepartmentId) {
      return 'Primary department is already included — remove it from overseen departments.'
    }
  }

  return null
}

/** Whether a member should appear when filtering the team list by department. */
export function memberMatchesDepartmentFilter(
  member: DepartmentMembershipUser,
  departmentId: string
): boolean {
  return memberVisibleInDepartment(member, departmentId)
}

export function getMemberDepartmentIdsForCounts(member: DepartmentMembershipUser): string[] {
  return getVisibleMemberDepartmentIds(member)
}

export function formatOverseenDepartmentsSummary(input: {
  jobLevel: JobLevel
  primaryDepartmentName: string | null
  overseenDepartmentNames: string[]
}): string | null {
  if (managingDirectorOverseesAllDepartments(input.jobLevel)) {
    return 'All departments'
  }

  if (input.overseenDepartmentNames.length === 0) {
    return null
  }

  return input.overseenDepartmentNames.join(', ')
}
