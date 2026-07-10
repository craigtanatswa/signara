import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { DashboardPageBody } from '@/components/layout/dashboard-page-body'
import { Button } from '@/components/ui/button'
import { TemplateCard } from '@/components/templates/template-card'
import { TemplateRequestsPanel } from '@/components/templates/template-requests-panel'
import { listPendingTemplateRequests } from '@/app/actions/template-requests'
import { FileEdit, Plus } from 'lucide-react'
import type { User, Template } from '@/types/database'

export default async function TemplatesPage() {
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
  if (profile.role !== 'admin') redirect('/dashboard')

  const user = profile as User

  const [{ data: templates }, { data: departments }, requestsResult] = await Promise.all([
    supabase
      .from('templates')
      .select('*')
      .eq('organisation_id', user.organisation_id)
      .order('updated_at', { ascending: false }),
    supabase.from('departments').select('id, name').eq('organisation_id', user.organisation_id),
    listPendingTemplateRequests(),
  ])

  const items = (templates ?? []) as Template[]
  const departmentNameById = new Map((departments ?? []).map((d) => [d.id, d.name]))
  const pendingRequests = requestsResult.requests

  return (
    <>
      <Header pageTitle="Templates" user={user} />
      <DashboardPageBody>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-signara-navy">Templates</h2>
              <p className="mt-0.5 text-sm text-signara-steel">
                Reusable document layouts with form fields and approval workflows.
              </p>
            </div>
            <Button
              asChild
              className="bg-signara-gold text-signara-navy font-semibold hover:bg-[#C49B2E]"
            >
              <Link href="/dashboard/templates/new">
                <Plus className="mr-1.5 size-4" />
                New template
              </Link>
            </Button>
          </div>

          <TemplateRequestsPanel requests={pendingRequests} />

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-signara-steel/40 bg-white py-20 text-center">
              <FileEdit className="size-12 text-signara-steel/30" />
              <h3 className="mt-4 font-semibold text-signara-navy">No templates yet</h3>
              <p className="mt-1 max-w-sm text-sm text-signara-steel">
                Create your first one — try a Leave Request or Purchase Order form.
              </p>
              <Button
                asChild
                className="mt-6 bg-signara-gold text-signara-navy font-semibold hover:bg-[#C49B2E]"
              >
                <Link href="/dashboard/templates/new">
                  <Plus className="mr-1.5 size-4" />
                  New template
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  departmentName={
                    template.department_id ? departmentNameById.get(template.department_id) : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>
      </DashboardPageBody>
    </>
  )
}
