'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  canHaveExplicitOverseenDepartments,
  managingDirectorOverseesAllDepartments,
} from '@/lib/org-structure/overseen-departments'
import type { DepartmentOption, JobLevel } from '@/types/org-structure'

interface OverseenDepartmentsFieldProps {
  jobLevel: JobLevel
  primaryDepartmentId: string
  departments: DepartmentOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export function OverseenDepartmentsField({
  jobLevel,
  primaryDepartmentId,
  departments,
  selectedIds,
  onChange,
}: OverseenDepartmentsFieldProps) {
  if (managingDirectorOverseesAllDepartments(jobLevel)) {
    return (
      <div className="space-y-1.5 rounded-md border border-signara-steel/25 bg-signara-background/60 px-4 py-3">
        <Label className="text-signara-navy font-medium">Departments overseen</Label>
        <p className="text-sm text-signara-navy">All departments</p>
        <p className="text-xs text-signara-steel">
          Managing Directors can approve for every department in your organisation.
        </p>
      </div>
    )
  }

  if (!canHaveExplicitOverseenDepartments(jobLevel)) {
    return null
  }

  const availableDepartments = departments.filter((d) => d.id !== primaryDepartmentId)

  function toggleDepartment(departmentId: string, checked: boolean) {
    if (checked) {
      onChange([...new Set([...selectedIds, departmentId])])
      return
    }
    onChange(selectedIds.filter((id) => id !== departmentId))
  }

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-signara-navy font-medium">Also oversees</Label>
        <p className="text-xs text-signara-steel">
          Select additional departments this person approves for. Their primary department is always
          included.
        </p>
      </div>

      {availableDepartments.length === 0 ? (
        <p className="text-xs text-signara-steel">No other departments available yet.</p>
      ) : (
        <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-signara-steel/25 bg-signara-background/40 p-3">
          {availableDepartments.map((department) => {
            const checked = selectedIds.includes(department.id)
            const checkboxId = `overseen-${department.id}`

            return (
              <div key={department.id} className="flex items-center gap-2">
                <Checkbox
                  id={checkboxId}
                  checked={checked}
                  onCheckedChange={(value) => toggleDepartment(department.id, value === true)}
                />
                <Label htmlFor={checkboxId} className="text-sm font-normal text-signara-navy">
                  {department.name}
                </Label>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
