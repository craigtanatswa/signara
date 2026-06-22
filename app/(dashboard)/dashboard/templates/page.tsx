import { Header } from '@/components/layout/header'
import { DashboardPageBody } from '@/components/layout/dashboard-page-body'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FileEdit } from 'lucide-react'
import type { User } from '@/types/database'

export default async function TemplatesPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')
  const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single()
  if (!profile) redirect('/login')
  if (profile.role !== 'admin') redirect('/dashboard')

  return (
    <>
      <Header pageTitle="Templates" user={profile as User} />
      <DashboardPageBody>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <FileEdit className="size-14 text-signara-steel/40" />
        <h2 className="mt-4 text-xl font-semibold text-signara-navy">Templates</h2>
        <p className="mt-2 text-signara-steel">Template builder coming soon.</p>
      </div>
      </DashboardPageBody>
    </>
  )
}
