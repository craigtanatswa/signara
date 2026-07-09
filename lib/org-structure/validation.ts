import {
  getJobLevelsForDepartment,
  isJobLevel,
  slugifyDepartmentName,
  type DepartmentOption,
  type JobLevel,
} from '@/types/org-structure'

export function findDepartment(
  departments: DepartmentOption[],
  departmentId: string | null | undefined
): DepartmentOption | undefined {
  if (!departmentId) return undefined
  return departments.find((d) => d.id === departmentId)
}

export function validateUserPlacement(input: {
  departmentId: string
  jobLevel: string
  departments: DepartmentOption[]
  hasManagingDirector: boolean
  editingUserId?: string
  currentUserJobLevel?: JobLevel | null
}): string | null {
  const department = findDepartment(input.departments, input.departmentId)
  if (!department) {
    return 'Select a valid department.'
  }

  if (!isJobLevel(input.jobLevel)) {
    return 'Select a valid job level.'
  }

  const jobLevel = input.jobLevel
  const allowed = getJobLevelsForDepartment(department.is_executive)

  if (!allowed.includes(jobLevel)) {
    const deptLabel = department.is_executive ? 'Executive' : department.name
    return `${getJobLevelLabelSafe(jobLevel)} is not allowed in ${deptLabel}.`
  }

  if (jobLevel === 'managing_director') {
    if (!department.is_executive) {
      return 'Managing Director must belong to the Executive department.'
    }
    if (input.hasManagingDirector && input.currentUserJobLevel !== 'managing_director') {
      return 'This organisation already has a Managing Director.'
    }
  }

  return null
}

function getJobLevelLabelSafe(level: JobLevel): string {
  const labels: Record<JobLevel, string> = {
    managing_director: 'Managing Director',
    director: 'Director',
    manager: 'Manager',
    supervisor: 'Supervisor',
    senior: 'Senior',
    staff: 'Staff',
  }
  return labels[level]
}

export function validateDepartmentName(name: string, existingNames: string[]): string | null {
  const trimmed = name.trim()
  if (trimmed.length < 2) {
    return 'Department name must be at least 2 characters.'
  }
  if (trimmed.length > 80) {
    return 'Department name is too long.'
  }
  const lower = trimmed.toLowerCase()
  if (['executive', 'ceo', 'managing director'].includes(lower)) {
    return 'Use the built-in Executive department for leadership roles.'
  }
  if (existingNames.some((n) => n.toLowerCase() === lower)) {
    return 'A department with this name already exists.'
  }
  return null
}

export function buildUniqueDepartmentSlug(name: string, existingSlugs: string[]): string {
  const base = slugifyDepartmentName(name)
  if (!existingSlugs.includes(base)) return base

  let counter = 2
  while (existingSlugs.includes(`${base}-${counter}`)) {
    counter += 1
  }
  return `${base}-${counter}`
}
