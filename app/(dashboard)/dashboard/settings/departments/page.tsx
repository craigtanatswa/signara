import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { DashboardPageBody } from '@/components/layout/dashboard-page-body'
import { BackLink } from '@/components/layout/back-link'
import { DepartmentsManager } from '@/components/users/departments-manager'
import type { User } from '@/types/database'
import type { DepartmentOption } from '@/types/org-structure'

export default async function DepartmentsSettingsPage() {
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
  if (userProfile.role !== 'admin') redirect('/dashboard/settings')

  const currentUser = userProfile as User

  const [{ data: departments }, { data: teamMembers }] = await Promise.all([
    supabase
      .from('departments')
      .select('id, name, slug, is_executive')
      .eq('organisation_id', currentUser.organisation_id)
      .order('is_executive', { ascending: false })
      .order('name'),
    supabase
      .from('users')
      .select('department_id')
      .eq('organisation_id', currentUser.organisation_id),
  ])

  const departmentList = (departments ?? []) as DepartmentOption[]

  const memberCounts = (teamMembers ?? []).reduce<Record<string, number>>((acc, member) => {
    if (!member.department_id) return acc
    acc[member.department_id] = (acc[member.department_id] ?? 0) + 1
    return acc
  }, {})

  return (
    <>
      <Header pageTitle="Departments" user={currentUser} />

      <DashboardPageBody>
        <div className="mx-auto max-w-2xl space-y-4">
          <BackLink href="/dashboard/settings" label="Back to settings" />
          <DepartmentsManager departments={departmentList} memberCounts={memberCounts} />
        </div>
      </DashboardPageBody>
    </>
  )
}
