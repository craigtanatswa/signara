// ─── Organisational job levels (authority order: 1 = highest) ───────────────

export const JOB_LEVELS = [
  'managing_director',
  'director',
  'manager',
  'supervisor',
  'senior',
  'staff',
] as const

export type JobLevel = (typeof JOB_LEVELS)[number]

export const JOB_LEVEL_RANK: Record<JobLevel, number> = {
  managing_director: 1,
  director: 2,
  manager: 3,
  supervisor: 4,
  senior: 5,
  staff: 6,
}

export const JOB_LEVEL_LABELS: Record<JobLevel, string> = {
  managing_director: 'Managing Director',
  director: 'Director',
  manager: 'Manager',
  supervisor: 'Supervisor',
  senior: 'Senior',
  staff: 'Staff',
}

/** Job levels allowed in the Executive department (no Director/Manager). */
export const EXECUTIVE_JOB_LEVELS: JobLevel[] = [
  'managing_director',
  'supervisor',
  'senior',
  'staff',
]

/** Job levels allowed in standard (non-executive) departments. */
export const STANDARD_JOB_LEVELS: JobLevel[] = [
  'director',
  'manager',
  'supervisor',
  'senior',
  'staff',
]

export function isJobLevel(value: unknown): value is JobLevel {
  return typeof value === 'string' && JOB_LEVELS.includes(value as JobLevel)
}

export function getJobLevelsForDepartment(isExecutive: boolean): JobLevel[] {
  return isExecutive ? EXECUTIVE_JOB_LEVELS : STANDARD_JOB_LEVELS
}

export function getJobLevelLabel(level: JobLevel): string {
  return JOB_LEVEL_LABELS[level]
}

export function slugifyDepartmentName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'department'
}

export interface DepartmentOption {
  id: string
  name: string
  slug: string
  is_executive: boolean
}

export interface UserOrgPlacement {
  department_id: string | null
  job_level: JobLevel
}

export interface OrgStructureContext {
  departments: DepartmentOption[]
  hasManagingDirector: boolean
}
