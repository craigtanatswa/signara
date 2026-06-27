import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
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

  if (userProfile.must_change_password) {
    redirect('/change-password')
  }

  const user: User = {
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
    <div className="flex h-screen overflow-hidden bg-signara-background">
      <Sidebar user={user} organisation={organisation} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  )
}
