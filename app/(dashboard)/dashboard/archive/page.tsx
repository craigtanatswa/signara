import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/header'
import { DashboardPageBody } from '@/components/layout/dashboard-page-body'
import { ArchiveClient } from '@/components/documents/archive-client'
import {
  loadArchivedDocuments,
  loadUserNamesById,
} from '@/lib/documents/load-for-viewer'
import {
  getVisibleMemberDepartmentIds,
  managingDirectorOverseesAllDepartments,
} from '@/lib/org-structure/overseen-departments'
import { loadOverseenDepartmentIdsByUser } from '@/lib/org-structure/load-overseen'
import type { User } from '@/types/database'
import type { JobLevel } from '@/types/org-structure'

export default async function ArchivePage() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()
  if (!profile) redirect('/login')

  const user = profile as User
  const admin = createAdminClient()
  const isAdmin = user.role === 'admin'
  const jobLevel = (user.job_level ?? 'officer') as JobLevel
  const seeAll = isAdmin || managingDirectorOverseesAllDepartments(jobLevel)

  const [{ data: departmentsData }, overseenByUser] = await Promise.all([
    admin
      .from('departments')
      .select('id, name')
      .eq('organisation_id', user.organisation_id)
      .order('name'),
    loadOverseenDepartmentIdsByUser(admin, user.organisation_id),
  ])

  const allDepartments = (departmentsData ?? []) as Array<{ id: string; name: string }>
  const overseenIds = overseenByUser.get(user.id) ?? []
  const controlledIds = seeAll
    ? allDepartments.map((d) => d.id)
    : getVisibleMemberDepartmentIds({
        department_id: user.department_id,
        job_level: jobLevel,
        overseen_department_ids: overseenIds,
      })

  const controlledSet = new Set(controlledIds)
  const departments = seeAll
    ? allDepartments
    : allDepartments.filter((d) => controlledSet.has(d.id))

  const rows = await loadArchivedDocuments(admin, {
    organisationId: user.organisation_id,
    departmentIds: controlledIds,
    seeAll,
  })

  const initiatorNameById = Object.fromEntries(
    await loadUserNamesById(
      admin,
      Array.from(new Set(rows.map((row) => row.initiated_by)))
    )
  )

  return (
    <>
      <Header pageTitle="Archive" user={user} />
      <DashboardPageBody>
        <ArchiveClient
          rows={rows}
          departments={departments}
          defaultDepartmentId={user.department_id}
          initiatorNameById={initiatorNameById}
        />
      </DashboardPageBody>
    </>
  )
}
