import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { DashboardPageBody } from '@/components/layout/dashboard-page-body'
import { BackLink } from '@/components/layout/back-link'
import { OrgInfoForm } from '@/components/settings/org-info-form'
import type { User, Organisation, Plan } from '@/types/database'

export default async function OrganisationSettingsPage() {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  const { data: userProfile } = await supabase
    .from('users')
    .select('*, organisations(*, plans(*))')
    .eq('id', authUser.id)
    .single()

  if (!userProfile) redirect('/login')

  const currentUser: User = {
    id: userProfile.id,
    email: userProfile.email,
    full_name: userProfile.full_name,
    organisation_id: userProfile.organisation_id,
    role: userProfile.role,
    avatar_url: userProfile.avatar_url,
    department: userProfile.department,
    must_change_password: userProfile.must_change_password,
    created_at: userProfile.created_at,
    updated_at: userProfile.updated_at,
  }

  if (currentUser.role !== 'admin') redirect('/dashboard/settings')

  const orgData = userProfile.organisations as (Organisation & { plans: Plan | null }) | null

  if (!orgData) redirect('/dashboard')

  const organisation: Organisation = {
    id: orgData.id,
    name: orgData.name,
    logo_url: orgData.logo_url,
    letterhead_url: orgData.letterhead_url ?? null,
    plan_id: orgData.plan_id,
    trial_ends_at: orgData.trial_ends_at,
    created_at: orgData.created_at,
    updated_at: orgData.updated_at,
  }

  const plan = orgData.plans ?? null

  return (
    <>
      <Header pageTitle="Organisation" user={currentUser} />

      <DashboardPageBody>
      <div className="max-w-xl space-y-8">
        {/* Back link */}
        <BackLink href="/dashboard/settings" label="Back to Settings" />

        {/* Org settings card */}
        <div className="rounded-lg border border-signara-steel/30 bg-white shadow-sm">
          <div className="border-b border-t-2 border-t-signara-gold border-signara-steel/20 px-6 py-4 rounded-t-lg">
            <h2 className="font-semibold text-signara-navy">Organisation settings</h2>
            <p className="mt-0.5 text-sm text-signara-steel">
              Manage your organisation details and plan.
            </p>
          </div>
          <div className="p-6">
            <OrgInfoForm organisation={organisation} plan={plan} />
          </div>
        </div>
      </div>
      </DashboardPageBody>
    </>
  )
}
