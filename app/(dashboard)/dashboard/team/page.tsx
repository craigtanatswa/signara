import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadOverseenDepartmentIdsByUser } from '@/lib/org-structure/load-overseen'
import { Header } from '@/components/layout/header'
import { DashboardPageBody } from '@/components/layout/dashboard-page-body'
import { TeamClient } from '@/components/users/team-client'
import { DepartmentsManager } from '@/components/users/departments-manager'
import type { User, UserWithDepartment } from '@/types/database'
import type { DepartmentOption } from '@/types/org-structure'
import { getMemberDepartmentIdsForCounts } from '@/lib/org-structure/overseen-departments'

export default async function TeamPage() {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  const { data: userProfile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (!userProfile) redirect('/login')
  if (userProfile.role !== 'admin') redirect('/dashboard')

  const currentUser = userProfile as User

  const [{ data: teamMembers, error: teamMembersError }, { data: departments }, overseenIdsByUser] =
    await Promise.all([
      supabase
        .from('users')
        .select('*')
        .eq('organisation_id', currentUser.organisation_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('departments')
        .select('id, name, slug, is_executive')
        .eq('organisation_id', currentUser.organisation_id)
        .order('is_executive', { ascending: false })
        .order('name'),
      loadOverseenDepartmentIdsByUser(supabase, currentUser.organisation_id),
    ])

  const departmentList = (departments ?? []) as DepartmentOption[]
  const departmentsById = new Map(departmentList.map((d) => [d.id, d]))

  const members = (teamMembers ?? []).map((member) => {
    const departmentRecord = member.department_id
      ? departmentsById.get(member.department_id)
      : undefined
    const overseenIds = overseenIdsByUser.get(member.id) ?? []

    return {
      ...(member as UserWithDepartment),
      departments: departmentRecord
        ? { id: departmentRecord.id, name: departmentRecord.name, is_executive: departmentRecord.is_executive }
        : null,
      overseen_departments: overseenIds
        .map((id) => departmentsById.get(id))
        .filter((d): d is DepartmentOption => Boolean(d))
        .map((d) => ({ id: d.id, name: d.name })),
    }
  })

  const memberCounts = members.reduce<Record<string, number>>((acc, member) => {
    getMemberDepartmentIdsForCounts(member).forEach((departmentId) => {
      acc[departmentId] = (acc[departmentId] ?? 0) + 1
    })
    return acc
  }, {})

  const hasManagingDirector = members.some((m) => m.job_level === 'managing_director')

  const totalCount = members.length
  const adminCount = members.filter((m) => m.role === 'admin').length
  const pendingCount = members.filter((m) => m.must_change_password).length

  return (
    <>
      <Header pageTitle="Team" user={currentUser} />

      <DashboardPageBody>
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total members', value: totalCount },
              { label: 'Admins', value: adminCount },
              { label: 'Pending setup', value: pendingCount },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-signara-steel/30 bg-white p-5 shadow-sm"
              >
                <p className="text-2xl font-bold text-signara-navy">{stat.value}</p>
                <p className="mt-0.5 text-sm text-signara-steel">{stat.label}</p>
              </div>
            ))}
          </div>

          <DepartmentsManager departments={departmentList} memberCounts={memberCounts} />
          {teamMembersError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              Could not load team members: {teamMembersError.message}
            </div>
          )}
          <TeamClient
            members={members}
            departments={departmentList}
            hasManagingDirector={hasManagingDirector}
            currentUserId={currentUser.id}
          />
        </div>
      </DashboardPageBody>
    </>
  )
}
