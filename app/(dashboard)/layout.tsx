import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { DEFAULT_BRAND_THEME, isBrandTheme } from '@/lib/brand-themes'
import type { User, Organisation } from '@/types/database'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/login')
  }

  const { data: userProfile } = await supabase
    .from('users')
    .select('*, organisations(*)')
    .eq('id', authUser.id)
    .single()

  if (!userProfile) {
    redirect('/login')
  }

  if (userProfile.is_active === false) {
    await supabase.auth.signOut()
    redirect('/login?error=deactivated')
  }

  if (userProfile.must_change_password) {
    redirect('/change-password')
  }

  const user: User = {
    id: userProfile.id,
    email: userProfile.email,
    full_name: userProfile.full_name,
    position: userProfile.position ?? null,
    organisation_id: userProfile.organisation_id,
    role: userProfile.role,
    avatar_url: userProfile.avatar_url,
    department: userProfile.department,
    department_id: userProfile.department_id,
    job_level: userProfile.job_level,
    must_change_password: userProfile.must_change_password,
    is_active: userProfile.is_active !== false,
    created_at: userProfile.created_at,
    updated_at: userProfile.updated_at,
  }

  const org = userProfile.organisations as Organisation | null

  const organisation: Organisation = org
    ? {
        ...org,
        brand_theme: isBrandTheme(org.brand_theme ?? '')
          ? org.brand_theme
          : DEFAULT_BRAND_THEME,
      }
    : {
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

  const brandTheme = isBrandTheme(organisation.brand_theme)
    ? organisation.brand_theme
    : DEFAULT_BRAND_THEME

  return (
    <div
      data-brand-theme={brandTheme}
      className="flex min-h-0 flex-1 overflow-hidden bg-signara-background"
    >
      <Sidebar user={user} organisation={organisation} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  )
}
