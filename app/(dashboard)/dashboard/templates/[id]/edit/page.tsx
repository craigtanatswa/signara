import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { TemplateEditClient } from '@/components/templates/template-edit-client'
import type { User, Template } from '@/types/database'

interface EditTemplatePageProps {
  params: Promise<{ id: string }>
}

export default async function EditTemplatePage({ params }: EditTemplatePageProps) {
  const { id } = await params
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

  const { data: templateData } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .eq('organisation_id', user.organisation_id)
    .single()

  if (!templateData) notFound()

  const template = templateData as Template

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Header pageTitle="Edit template" user={user} />
      <TemplateEditClient mode="edit" template={template} />
    </div>
  )
}
