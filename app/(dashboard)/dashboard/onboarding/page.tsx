import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'
import { buildOnboardingItems, templateHasWorkflow } from '@/lib/onboarding/items'
import type { Workflow } from '@/types/workflow'
import Image from 'next/image'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  const { data: user } = await supabase
    .from('users')
    .select('id, role, organisation_id, onboarding_completed_at, full_name')
    .eq('id', authUser.id)
    .single()

  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/dashboard')
  if (user.onboarding_completed_at) redirect('/dashboard')

  const [usersCountResult, templatesResult, lifetimeDocsResult, orgResult] = await Promise.all([
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('organisation_id', user.organisation_id),
    supabase
      .from('templates')
      .select('id, workflow')
      .eq('organisation_id', user.organisation_id),
    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('organisation_id', user.organisation_id),
    supabase
      .from('organisations')
      .select('logo_url')
      .eq('id', user.organisation_id)
      .maybeSingle(),
  ])

  const templates = templatesResult.data ?? []
  const items = buildOnboardingItems({
    userCount: usersCountResult.count ?? 0,
    templateCount: templates.length,
    hasWorkflow: templates.some((t) => templateHasWorkflow(t.workflow as Workflow | null)),
    lifetimeDocCount: lifetimeDocsResult.count ?? 0,
    hasLogo: Boolean(orgResult.data?.logo_url),
  })

  return (
    <div className="min-h-full bg-signara-background">
      <div className="flex justify-center border-b border-signara-steel/20 bg-white px-4 py-4">
        <Image
          src="/assets/logo-signara.png"
          alt="Signara"
          width={160}
          height={70}
          className="h-12 w-auto object-contain"
          priority
        />
      </div>
      <OnboardingWizard items={items} />
    </div>
  )
}
