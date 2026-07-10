import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { DashboardPageBody } from '@/components/layout/dashboard-page-body'
import { Button } from '@/components/ui/button'
import { DocumentsTabs, type DocumentRow } from '@/components/documents/documents-tabs'
import { Plus } from 'lucide-react'
import type { User, Document, DocumentStep } from '@/types/database'

type DocumentQueryRow = Pick<Document, 'id' | 'title' | 'status' | 'created_at' | 'initiated_by'> & {
  templates: { name: string } | { name: string }[] | null
}

function getTemplateName(templates: DocumentQueryRow['templates']): string {
  const template = Array.isArray(templates) ? templates[0] : templates
  return template?.name ?? 'Unknown template'
}

function buildStepProgress(
  steps: Pick<DocumentStep, 'step_order' | 'status'>[]
): DocumentRow['stepProgress'] {
  if (steps.length === 0) return null
  const pendingIndex = steps.findIndex((step) => step.status === 'pending')
  const approvedCount = steps.filter((step) => step.status === 'approved').length
  const current = pendingIndex >= 0 ? pendingIndex + 1 : Math.min(approvedCount + 1, steps.length)
  return { current, total: steps.length }
}

export default async function DocumentsPage() {
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

  const user = profile as User
  const isAdmin = user.role === 'admin'

  const [{ data: myDocsRaw }, { data: awaitingStepsRaw }, allDocsResult] = await Promise.all([
    supabase
      .from('documents')
      .select('id, title, status, created_at, initiated_by, templates(name)')
      .eq('organisation_id', user.organisation_id)
      .eq('initiated_by', user.id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('document_steps')
      .select(
        'document_id, documents!inner(id, title, status, created_at, initiated_by, organisation_id, templates(name))'
      )
      .eq('assignee_user_id', user.id)
      .eq('status', 'pending')
      .eq('documents.organisation_id', user.organisation_id),
    isAdmin
      ? supabase
          .from('documents')
          .select('id, title, status, created_at, initiated_by, templates(name)')
          .eq('organisation_id', user.organisation_id)
          .order('created_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: null }),
  ])

  const myDocs = (myDocsRaw ?? []) as DocumentQueryRow[]
  const awaitingDocs = (awaitingStepsRaw ?? [])
    .map((row) => {
      const doc = Array.isArray(row.documents) ? row.documents[0] : row.documents
      return doc as DocumentQueryRow | undefined
    })
    .filter((doc): doc is DocumentQueryRow => Boolean(doc))
  const allDocs = allDocsResult.data as DocumentQueryRow[] | null

  const allIds = Array.from(
    new Set([...myDocs, ...awaitingDocs, ...(allDocs ?? [])].map((doc) => doc.id))
  )
  const initiatorIds = Array.from(
    new Set([...myDocs, ...awaitingDocs, ...(allDocs ?? [])].map((doc) => doc.initiated_by))
  )

  const [{ data: stepsData }, { data: initiatorsData }] = await Promise.all([
    allIds.length > 0
      ? supabase.from('document_steps').select('document_id, step_order, status').in('document_id', allIds)
      : Promise.resolve({ data: [] }),
    initiatorIds.length > 0
      ? supabase.from('users').select('id, full_name').in('id', initiatorIds)
      : Promise.resolve({ data: [] }),
  ])

  const stepsByDocument = new Map<string, Pick<DocumentStep, 'step_order' | 'status'>[]>()
  for (const step of stepsData ?? []) {
    const list = stepsByDocument.get(step.document_id) ?? []
    list.push(step)
    stepsByDocument.set(step.document_id, list)
  }
  for (const list of stepsByDocument.values()) {
    list.sort((a, b) => a.step_order - b.step_order)
  }

  const initiatorNameById = new Map((initiatorsData ?? []).map((row) => [row.id, row.full_name]))

  function toRow(doc: DocumentQueryRow): DocumentRow {
    return {
      id: doc.id,
      title: doc.title,
      templateName: getTemplateName(doc.templates),
      status: doc.status,
      initiatorName: initiatorNameById.get(doc.initiated_by) ?? 'Unknown',
      createdAt: doc.created_at,
      stepProgress:
        doc.status === 'in_progress' ? buildStepProgress(stepsByDocument.get(doc.id) ?? []) : null,
    }
  }

  const myDocuments = myDocs.map(toRow)
  const awaitingMyAction = awaitingDocs.map(toRow)
  const allDocuments = allDocs ? allDocs.map(toRow) : null

  return (
    <>
      <Header pageTitle="Documents" user={user} />
      <DashboardPageBody>
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-signara-navy">Documents</h2>
              <p className="mt-0.5 text-sm text-signara-steel">
                Submit forms and track approval progress.
              </p>
            </div>
            <Button asChild variant="signara">
              <Link href="/dashboard/documents/new">
                <Plus className="mr-1.5 size-4" />
                New document
              </Link>
            </Button>
          </div>

          <DocumentsTabs
            myDocuments={myDocuments}
            awaitingMyAction={awaitingMyAction}
            allDocuments={allDocuments}
          />
        </div>
      </DashboardPageBody>
    </>
  )
}
