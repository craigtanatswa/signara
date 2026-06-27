import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { DashboardPageBody } from '@/components/layout/dashboard-page-body'
import { BackLink } from '@/components/layout/back-link'
import { ProfileInfoForm } from '@/components/settings/profile-info-form'
import { ChangePasswordForm } from '@/components/settings/change-password-form'
import type { User, Organisation } from '@/types/database'

export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  const { data: userProfile } = await supabase
    .from('users')
    .select('*, organisations(*)')
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

  const org = userProfile.organisations as Organisation | null
  const organisation: Organisation = org ?? {
    id: userProfile.organisation_id,
    name: 'My Organisation',
    logo_url: null,
    letterhead_url: null,
    plan_id: null,
    trial_ends_at: null,
    created_at: '',
    updated_at: '',
  }

  return (
    <>
      <Header pageTitle="Profile" user={currentUser} />

      <DashboardPageBody>
      <div className="max-w-xl space-y-8">
        {/* Back link */}
        <BackLink href="/dashboard/settings" label="Back to Settings" />

        {/* Section A: Profile information */}
        <div className="rounded-lg border border-signara-steel/30 bg-white shadow-sm">
          <div className="border-b border-t-2 border-t-signara-gold border-signara-steel/20 px-6 py-4 rounded-t-lg">
            <h2 className="font-semibold text-signara-navy">Profile information</h2>
            <p className="mt-0.5 text-sm text-signara-steel">Update your personal details.</p>
          </div>
          <div className="p-6">
            <ProfileInfoForm user={currentUser} organisation={organisation} />
          </div>
        </div>

        {/* Section B: Change password */}
        <div className="rounded-lg border border-signara-steel/30 bg-white shadow-sm">
          <div className="border-b border-signara-steel/20 px-6 py-4">
            <h2 className="font-semibold text-signara-navy">Change password</h2>
            <p className="mt-0.5 text-sm text-signara-steel">
              Choose a strong password to keep your account secure.
            </p>
          </div>
          <div className="p-6">
            <ChangePasswordForm />
          </div>
        </div>
      </div>
      </DashboardPageBody>
    </>
  )
}
