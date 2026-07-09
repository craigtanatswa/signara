import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { listTemplateFields } from '@/lib/tiptap/field-utils'
import { listApproverSignatureFieldOptions, syncWorkflowStepsWithSignatures } from '@/lib/workflow/signature-fields'
import { WorkflowBuilderClient } from '@/components/workflow/workflow-builder-client'
import { normaliseWorkflow } from '@/types/workflow'
import type { Template, User } from '@/types/database'
import type { TemplateFieldOption, Workflow } from '@/types/workflow'

interface WorkflowPageProps {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export default async function WorkflowPage({ params }: WorkflowPageProps) {
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

  const { data: templateData, error: templateError } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .eq('organisation_id', profile.organisation_id)
    .maybeSingle()

  if (templateError || !templateData) notFound()

  const template = templateData as Template

  const signatureFields = listApproverSignatureFieldOptions(template.content)

  const templateFields: TemplateFieldOption[] = listTemplateFields(template.content).map((field) => ({
    fieldId: field.fieldId,
    label: field.label,
  }))

  const existingSteps =
    template.workflow && template.workflow.steps?.length > 0
      ? normaliseWorkflow(template.workflow).steps
      : []

  const workflow: Workflow = {
    steps: syncWorkflowStepsWithSignatures(existingSteps, signatureFields),
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Header pageTitle="Approval chain" user={user} />
      <WorkflowBuilderClient
        templateId={template.id}
        templateName={template.name}
        initialWorkflow={workflow}
        templateFields={templateFields}
        signatureFields={signatureFields}
      />
    </div>
  )
}
