'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { InviteUserDialog } from '@/components/users/invite-user-dialog'
import { EditMemberPlacementDialog } from '@/components/users/edit-member-placement-dialog'
import { RemoveMemberDialog } from '@/components/users/remove-member-dialog'
import { ActivateMemberDialog } from '@/components/users/activate-member-dialog'
import { ResetPasswordDialog } from '@/components/users/reset-password-dialog'
import { MemberActionsMenu } from '@/components/users/member-actions-menu'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { JOB_LEVEL_LABELS } from '@/types/org-structure'
import { formatOverseenDepartmentsSummary, memberMatchesDepartmentFilter } from '@/lib/org-structure/overseen-departments'
import type { DepartmentOption } from '@/types/org-structure'
import type { JobLevel } from '@/types/org-structure'
import type { UserWithDepartment } from '@/types/database'

const ALL_DEPARTMENTS = 'all'
const UNASSIGNED_DEPARTMENT = 'unassigned'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

interface TeamClientProps {
  members: UserWithDepartment[]
  departments: DepartmentOption[]
  hasManagingDirector: boolean
  currentUserId: string
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatMemberDepartment(member: UserWithDepartment): React.ReactNode {
  const primaryName = member.departments?.name ?? member.department
  const overseenSummary =
    member.job_level === 'managing_director'
      ? null
      : formatOverseenDepartmentsSummary({
          jobLevel: member.job_level,
          primaryDepartmentName: primaryName ?? null,
          overseenDepartmentNames: member.overseen_departments?.map((d) => d.name) ?? [],
        })

  if (!primaryName && !overseenSummary) {
    return <span className="text-signara-steel">—</span>
  }

  return (
    <div className="space-y-0.5">
      <p>{primaryName ?? '—'}</p>
      {overseenSummary && (
        <p className="text-xs text-signara-steel">Also oversees: {overseenSummary}</p>
      )}
    </div>
  )
}

function jobLevelLabel(level: JobLevel | string | undefined): string {
  if (level && level in JOB_LEVEL_LABELS) {
    return JOB_LEVEL_LABELS[level as JobLevel]
  }
  return 'Staff'
}

function isMemberActive(member: UserWithDepartment): boolean {
  return member.is_active !== false
}

export function TeamClient({
  members,
  departments,
  hasManagingDirector,
  currentUserId,
}: TeamClientProps) {
  const router = useRouter()
  const [departmentFilter, setDepartmentFilter] = useState(ALL_DEPARTMENTS)

  const hasUnassignedMembers = members.some((member) => !member.department_id)

  const filteredMembers = useMemo(() => {
    if (departmentFilter === ALL_DEPARTMENTS) return members
    if (departmentFilter === UNASSIGNED_DEPARTMENT) {
      return members.filter((member) => !member.department_id)
    }
    return members.filter((member) => memberMatchesDepartmentFilter(member, departmentFilter))
  }, [members, departmentFilter])

  const isFiltered = departmentFilter !== ALL_DEPARTMENTS

  return (
    <div className="rounded-lg border border-signara-steel/30 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-signara-steel/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
          <div>
            <h3 className="font-semibold text-signara-navy">Members</h3>
            {isFiltered && (
              <p className="mt-0.5 text-xs text-signara-steel">
                Showing {filteredMembers.length} of {members.length}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="member-department-filter" className="text-xs font-medium text-signara-steel">
              Filter by department
            </Label>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger
                id="member-department-filter"
                className="h-9 w-full min-w-[12rem] border-signara-steel/30 bg-white text-signara-navy sm:w-52"
              >
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_DEPARTMENTS}>All departments</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
                {hasUnassignedMembers && (
                  <SelectItem value={UNASSIGNED_DEPARTMENT}>No department</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <InviteUserDialog
          departments={departments}
          hasManagingDirector={hasManagingDirector}
          onSuccess={() => router.refresh()}
        />
      </div>

      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="font-medium text-signara-navy">No team members yet</p>
          <p className="mt-1 text-sm text-signara-steel">
            Invite your first member using the button above.
          </p>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="font-medium text-signara-navy">No members match this filter</p>
          <p className="mt-1 text-sm text-signara-steel">
            Try &ldquo;All departments&rdquo;, or assign members to this department.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4 border-signara-navy text-signara-navy hover:bg-signara-navy hover:text-white"
            onClick={() => setDepartmentFilter(ALL_DEPARTMENTS)}
          >
            Show all members
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-signara-steel/20">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-signara-steel">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-signara-steel">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-signara-steel">
                  Job level
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-signara-steel">
                  Access
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-signara-steel">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-signara-steel">
                  Joined
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-signara-steel">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-signara-steel/10">
              {filteredMembers.map((member) => (
                <tr key={member.id} className="hover:bg-signara-background/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-signara-navy text-xs font-bold text-white">
                        {getInitials(member.full_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-signara-navy">
                          {member.full_name}
                        </p>
                        {member.position?.trim() ? (
                          <p className="truncate text-xs text-signara-steel">{member.position}</p>
                        ) : null}
                        <p className="truncate text-xs text-signara-steel">{member.email}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-sm text-signara-navy">
                    {formatMemberDepartment(member)}
                  </td>

                  <td className="px-6 py-4">
                    <Badge variant="outline" className="border-signara-navy/20 bg-signara-navy/5 text-signara-navy">
                      {jobLevelLabel(member.job_level)}
                    </Badge>
                  </td>

                  <td className="px-6 py-4">
                    <Badge
                      className={
                        member.role === 'admin'
                          ? 'bg-signara-navy/10 text-signara-navy border-signara-navy/20 hover:bg-signara-navy/10'
                          : 'bg-signara-steel/10 text-signara-steel border-signara-steel/20 hover:bg-signara-steel/10'
                      }
                      variant="outline"
                    >
                      {member.role === 'admin' ? 'Admin' : 'Member'}
                    </Badge>
                  </td>

                  <td className="px-6 py-4">
                    {!isMemberActive(member) ? (
                      <Badge
                        className="bg-red-50 text-red-700 border-red-200 hover:bg-red-50"
                        variant="outline"
                      >
                        Deactivated
                      </Badge>
                    ) : member.must_change_password ? (
                      <Badge
                        className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50"
                        variant="outline"
                      >
                        Pending setup
                      </Badge>
                    ) : (
                      <Badge
                        className="bg-green-50 text-green-700 border-green-200 hover:bg-green-50"
                        variant="outline"
                      >
                        Active
                      </Badge>
                    )}
                  </td>

                  <td className="px-6 py-4 text-sm text-signara-steel">
                    {formatDate(member.created_at)}
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <ActivateMemberDialog
                        member={member}
                        onSuccess={() => router.refresh()}
                      />
                      <ResetPasswordDialog
                        member={member}
                        currentUserId={currentUserId}
                        onSuccess={() => router.refresh()}
                      />
                      <EditMemberPlacementDialog
                        member={member}
                        departments={departments}
                        hasManagingDirector={hasManagingDirector}
                        onSuccess={() => router.refresh()}
                      />
                      <RemoveMemberDialog
                        member={member}
                        currentUserId={currentUserId}
                        onSuccess={() => router.refresh()}
                      />
                      <MemberActionsMenu
                        member={member}
                        currentUserId={currentUserId}
                        onSuccess={() => router.refresh()}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
