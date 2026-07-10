import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { DashboardPageBody } from '@/components/layout/dashboard-page-body'
import { AdminRequestsClient } from '@/components/templates/admin-requests-client'
import { MyRequestsClient } from '@/components/templates/my-requests-client'
import {
  listMyTemplateRequests,
  listOrganisationTemplateRequests,
} from '@/app/actions/template-requests'
import { canRequestTemplate } from '@/lib/templates/can-request-template'
import type { User } from '@/types/database'
import type { DepartmentOption } from '@/types/org-structure'

export default async function RequestsPage() {
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
  const isAdmin = user.role === 'admin'

  if (isAdmin) {
    const { requests, error } = await listOrganisationTemplateRequests('all')

    return (
      <>
        <Header pageTitle="Requests" user={user} />
        <DashboardPageBody>
          {error && (
            <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              {error}
            </p>
          )}
          <AdminRequestsClient requests={requests} />
        </DashboardPageBody>
      </>
    )
  }

  const eligibleToRequest = canRequestTemplate(user.job_level)
  const [{ requests, error }, { data: departmentsData }] = await Promise.all([
    listMyTemplateRequests(),
    eligibleToRequest
      ? supabase
          .from('departments')
          .select('id, name, slug, is_executive')
          .eq('organisation_id', user.organisation_id)
          .order('name')
      : Promise.resolve({ data: [] as DepartmentOption[] }),
  ])

  const departments = (departmentsData ?? []) as DepartmentOption[]

  return (
    <>
      <Header pageTitle="Requests" user={user} />
      <DashboardPageBody>
        {error && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {error}
          </p>
        )}
        <MyRequestsClient
          requests={requests}
          canRequest={eligibleToRequest}
          departments={departments}
          defaultDepartmentId={user.department_id}
        />
      </DashboardPageBody>
    </>
  )
}
