import { Header } from '@/components/layout/header'
import { DashboardPageBody } from '@/components/layout/dashboard-page-body'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FileText } from 'lucide-react'
import type { User } from '@/types/database'

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')
  const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single()
  if (!profile) redirect('/login')

  return (
    <>
      <Header pageTitle="Documents" user={profile as User} />
      <DashboardPageBody>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <FileText className="size-14 text-signara-steel/40" />
        <h2 className="mt-4 text-xl font-semibold text-signara-navy">Documents</h2>
        <p className="mt-2 text-signara-steel">Document management coming soon.</p>
      </div>
      </DashboardPageBody>
    </>
  )
}
