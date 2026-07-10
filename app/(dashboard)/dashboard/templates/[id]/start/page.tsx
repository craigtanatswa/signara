import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { DashboardPageBody } from '@/components/layout/dashboard-page-body'
import { BackLink } from '@/components/layout/back-link'
import { InitiationWizard } from '@/components/documents/initiation-wizard'
import { getDocumentInitiationContext } from '@/app/actions/documents'
import { getOrganisationBrandingForOrg } from '@/app/actions/organisation-branding'
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

  const organisationBranding = await getOrganisationBrandingForOrg(user.organisation_id)

  return (
    <>
      <Header pageTitle={context.template.name} user={user} />
      <DashboardPageBody className="p-4 pb-0">
        <div className="mx-auto flex min-h-0 w-full max-w-[860px] flex-col">
          <div className="relative mb-3 flex items-center">
            <BackLink href="/dashboard/documents/new" label="Back to templates" />
            <p className="pointer-events-none absolute inset-x-0 text-center text-sm text-signara-steel">
              Fill in details, assign approvers, then submit
            </p>
          </div>
          <InitiationWizard
            templateId={context.template.id}
            templateName={context.template.name}
            templateContent={context.template.content}
            organisationBranding={organisationBranding}
            initialSteps={context.steps}
            initialBlockingError={context.blockingError}
          />
        </div>
      </DashboardPageBody>
    </>
  )
}
