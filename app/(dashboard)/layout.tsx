import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { AppViewport } from '@/components/layout/app-viewport'
import { PlanUpgradeRequiredGate } from '@/components/billing/plan-upgrade-required-gate'
import { getPlanUpgradeLock } from '@/lib/billing/plan-upgrade-lock'
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

  const pathname = (await headers()).get('x-pathname') ?? ''
  const needsOnboarding =
    userProfile.role === 'admin' && !userProfile.onboarding_completed_at
  const onOnboardingRoute = pathname.startsWith('/dashboard/onboarding')

  if (needsOnboarding && (pathname === '/dashboard' || pathname === '/dashboard/')) {
    redirect('/dashboard/onboarding')
  }

  const orgForTrial = userProfile.organisations as Organisation | null

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
    onboarding_completed_at: userProfile.onboarding_completed_at ?? null,
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

  const upgradeLock = orgForTrial
    ? await getPlanUpgradeLock({
        id: orgForTrial.id,
        plan_id: orgForTrial.plan_id,
        subscription_status: orgForTrial.subscription_status,
        trial_ends_at: orgForTrial.trial_ends_at,
        minimum_plan_id: orgForTrial.minimum_plan_id ?? null,
      })
    : null

  if (needsOnboarding && onOnboardingRoute) {
    return (
      <AppViewport>
        <div
          data-brand-theme={brandTheme}
          className="flex min-h-0 flex-1 overflow-hidden bg-signara-background"
        >
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</main>
        </div>
      </AppViewport>
    )
  }

  return (
    <AppViewport>
      <div
        data-brand-theme={brandTheme}
        className="flex min-h-0 flex-1 overflow-hidden bg-signara-background"
      >
        <PlanUpgradeRequiredGate lock={upgradeLock} isAdmin={user.role === 'admin'}>
          <Sidebar
            user={user}
            organisation={organisation}
            settingsHref={
              upgradeLock ? '/dashboard/settings/billing' : '/dashboard/settings'
            }
          />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {needsOnboarding && (
              <div className="flex items-center justify-between gap-3 border-b border-signara-gold/40 bg-signara-gold/15 px-4 py-2 text-sm text-signara-navy">
                <span>Finish organisation setup to unlock your full dashboard.</span>
                <a
                  href="/dashboard/onboarding"
                  className="font-semibold text-signara-navy underline-offset-2 hover:underline"
                >
                  Continue setup
                </a>
              </div>
            )}
            <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
          </div>
        </PlanUpgradeRequiredGate>
      </div>
    </AppViewport>
  )
}
