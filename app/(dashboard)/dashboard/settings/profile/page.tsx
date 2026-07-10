import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { DashboardPageBody } from '@/components/layout/dashboard-page-body'
import { BackLink } from '@/components/layout/back-link'
import { ProfileInfoForm } from '@/components/settings/profile-info-form'
import { ChangePasswordForm } from '@/components/settings/change-password-form'
import { SavedSignaturesManager } from '@/components/settings/saved-signatures-manager'
import { DEFAULT_BRAND_THEME } from '@/lib/brand-themes'
import type { UserWithDepartment, Organisation, UserSignature } from '@/types/database'

export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  const [{ data: userProfile }, signaturesResult] = await Promise.all([
    supabase
      .from('users')
      .select('*, organisations(*), departments(id, name, is_executive)')
      .eq('id', authUser.id)
      .single(),
    supabase
      .from('user_signatures')
      .select('*')
      .eq('user_id', authUser.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  if (!userProfile) redirect('/login')

  const currentUser = userProfile as UserWithDepartment & { organisations: Organisation | null }
  const signatures = (signaturesResult.error ? [] : (signaturesResult.data ?? [])) as UserSignature[]
  const org = currentUser.organisations
  const organisation: Organisation = org ?? {
    id: userProfile.organisation_id,
    name: 'My Organisation',
    logo_url: null,
    letterhead_url: null,
    letterhead_landscape_url: null,
    brand_theme: DEFAULT_BRAND_THEME,
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

        {/* Section B: Saved signatures */}
        <div className="rounded-lg border border-signara-steel/30 bg-white shadow-sm">
          <div className="border-b border-t-2 border-t-signara-gold border-signara-steel/20 px-6 py-4 rounded-t-lg">
            <h2 className="font-semibold text-signara-navy">Saved signatures</h2>
            <p className="mt-0.5 text-sm text-signara-steel">
              Manage your library here — set a default, delete ones you no longer need, or add a new
              signature to reuse when approving documents.
            </p>
          </div>
          <div className="p-6">
            <SavedSignaturesManager initialSignatures={signatures} />
          </div>
        </div>

        {/* Section C: Change password */}
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
