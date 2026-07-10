import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { DashboardPageBody } from '@/components/layout/dashboard-page-body'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getActiveTemplatesForInitiation } from '@/app/actions/documents'
import { canRequestTemplate } from '@/lib/templates/can-request-template'
import { FileText, Inbox, PlayCircle, Plus } from 'lucide-react'
import type { User } from '@/types/database'

export default async function NewDocumentPage() {
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
  const { templates, error } = await getActiveTemplatesForInitiation()
  const eligibleToRequest = canRequestTemplate(user.job_level)

  return (
    <>
      <Header pageTitle="New document" user={user} />
      <DashboardPageBody>
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-signara-navy">Start a document</h2>
              <p className="mt-1 text-sm text-signara-steel">
                Choose an active template. You&apos;ll pick an approver for each step next.
              </p>
            </div>
            {eligibleToRequest && (
              <Button
                asChild
                variant="outline"
                className="border-signara-navy text-signara-navy hover:bg-signara-navy hover:text-white"
              >
                <Link href="/dashboard/requests">
                  <Inbox className="mr-1.5 size-4" />
                  Request a template
                </Link>
              </Button>
            )}
          </div>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              {error}
            </p>
          )}

          {templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-signara-steel/40 bg-white py-16 text-center">
              <FileText className="size-12 text-signara-steel/30" />
              {user.role === 'admin' ? (
                <>
                  <p className="mt-4 font-medium text-signara-navy">No templates ready</p>
                  <p className="mt-1 max-w-sm text-sm text-signara-steel">
                    Create a template with an approval chain before anyone can start a document.
                  </p>
                  <Button asChild variant="signara" className="mt-6">
                    <Link href="/dashboard/templates/new">
                      <Plus className="mr-1.5 size-4" />
                      Create your first template
                    </Link>
                  </Button>
                </>
              ) : eligibleToRequest ? (
                <>
                  <p className="mt-4 font-medium text-signara-navy">No templates available yet</p>
                  <p className="mt-1 max-w-sm text-sm text-signara-steel">
                    Upload a scan of the paper form you need and ask an administrator to digitise
                    it for your department.
                  </p>
                  <Button asChild variant="signara" className="mt-6">
                    <Link href="/dashboard/requests">
                      <Inbox className="mr-1.5 size-4" />
                      Go to Requests
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <p className="mt-4 font-medium text-signara-navy">No templates available yet</p>
                  <p className="mt-1 max-w-sm text-sm text-signara-steel">
                    Ask your administrator to set one up, or ask a senior or supervisor in your
                    department to request one.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex flex-col rounded-lg border border-signara-steel/30 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-signara-navy">{template.name}</h3>
                    <Badge
                      variant="outline"
                      className="shrink-0 border-signara-navy/20 bg-signara-navy/5 text-[10px] text-signara-navy"
                    >
                      {template.scope === 'department'
                        ? (template.departmentName ?? 'Department')
                        : 'Organisation'}
                    </Badge>
                  </div>
                  {template.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-signara-steel">
                      {template.description}
                    </p>
                  )}
                  <Badge
                    variant="outline"
                    className="mt-3 w-fit border-signara-gold/40 bg-signara-gold/10 text-[11px] text-signara-navy"
                  >
                    {template.stepCount} approval step{template.stepCount === 1 ? '' : 's'}
                  </Badge>
                  <Button asChild variant="signara" className="mt-4 w-full">
                    <Link href={`/dashboard/templates/${template.id}/start`}>
                      <PlayCircle className="mr-2 size-4" />
                      Start
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DashboardPageBody>
    </>
  )
}
