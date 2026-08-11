'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { buildOnboardingItems, templateHasWorkflow } from '@/lib/onboarding/items'
import type { Workflow } from '@/types/workflow'

export async function completeOnboardingWizard() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id, role, organisation_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { error: 'Only organisation admins complete onboarding.' }
  }

  const [usersCountResult, templatesResult, lifetimeDocsResult, orgResult] = await Promise.all([
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('organisation_id', profile.organisation_id),
    supabase
      .from('templates')
      .select('id, workflow')
      .eq('organisation_id', profile.organisation_id),
    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('organisation_id', profile.organisation_id),
    supabase
      .from('organisations')
      .select('logo_url')
      .eq('id', profile.organisation_id)
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

  if (items.some((item) => !item.complete)) {
    return { error: 'Complete every setup step before finishing.' }
  }

  const { error } = await supabase
    .from('users')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', profile.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/onboarding')
  return { success: true }
}
