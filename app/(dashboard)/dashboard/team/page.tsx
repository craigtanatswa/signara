import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { DashboardPageBody } from '@/components/layout/dashboard-page-body'
import { TeamClient } from '@/components/users/team-client'
import type { User } from '@/types/database'

export default async function TeamPage() {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  const { data: userProfile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (!userProfile) redirect('/login')
  if (userProfile.role !== 'admin') redirect('/dashboard')

  const currentUser = userProfile as User

  const { data: teamMembers } = await supabase
    .from('users')
    .select('*')
    .eq('organisation_id', currentUser.organisation_id)
    .order('created_at', { ascending: false })

  const members = (teamMembers ?? []) as User[]

  const totalCount = members.length
  const adminCount = members.filter((m) => m.role === 'admin').length
  const pendingCount = members.filter((m) => m.must_change_password).length

  return (
    <>
      <Header pageTitle="Team" user={currentUser} />

      <DashboardPageBody>
        <div className="space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total members', value: totalCount },
              { label: 'Admins', value: adminCount },
              { label: 'Pending setup', value: pendingCount },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-signara-steel/30 bg-white p-5 shadow-sm"
              >
                <p className="text-2xl font-bold text-signara-navy">{stat.value}</p>
                <p className="mt-0.5 text-sm text-signara-steel">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Team table */}
          <TeamClient members={members} />
        </div>
      </DashboardPageBody>
    </>
  )
}
