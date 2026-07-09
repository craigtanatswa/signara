import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { DashboardPageBody } from '@/components/layout/dashboard-page-body'
import { BackLink } from '@/components/layout/back-link'
import { StartDocumentClient } from '@/components/documents/start-document-client'
import { getDocumentInitiationContext } from '@/app/actions/documents'
import type { User } from '@/types/database'

interface StartDocumentPageProps {
  params: Promise<{ id: string }>
}

export default async function StartDocumentPage({ params }: StartDocumentPageProps) {
  const { id } = await params
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

  const context = await getDocumentInitiationContext(id)

  if ('error' in context) {
    notFound()
  }

  return (
    <>
      <Header pageTitle="Start document" user={user} />
      <DashboardPageBody>
        <div className="mx-auto max-w-xl space-y-6">
          <BackLink href="/dashboard/documents/new" label="Back to templates" />
          <div>
            <h2 className="text-xl font-bold text-signara-navy">{context.template.name}</h2>
            <p className="mt-1 text-sm text-signara-steel">
              Choose an approver for each step below. Every approver must be more senior than
              you, and the chain runs in order — the next approver is notified once the previous
              one signs.
            </p>
          </div>
          <StartDocumentClient
            templateId={context.template.id}
            templateName={context.template.name}
            steps={context.steps}
            blockingError={context.blockingError}
          />
        </div>
      </DashboardPageBody>
    </>
  )
}
