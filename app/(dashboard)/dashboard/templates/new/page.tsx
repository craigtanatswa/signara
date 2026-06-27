import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { TemplateEditClient } from '@/components/templates/template-edit-client'
import type { User } from '@/types/database'

export default async function NewTemplatePage() {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()
  if (!profile) redirect('/login')
  if (profile.role !== 'admin') redirect('/dashboard')

  const user = profile as User

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Header pageTitle="New template" user={user} />
      <TemplateEditClient mode="new" />
    </div>
  )
}
