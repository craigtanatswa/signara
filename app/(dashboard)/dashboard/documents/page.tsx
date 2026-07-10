import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/header'
import { DashboardPageBody } from '@/components/layout/dashboard-page-body'
import { Button } from '@/components/ui/button'
import { DocumentsTabs, type DocumentRow, type AwaitingDocumentRow } from '@/components/documents/documents-tabs'
import { Plus } from 'lucide-react'
import {
  loadAwaitingApprovalsForUser,
  loadInitiatedDocuments,
  loadOrganisationDocuments,
  loadStepProgressByDocument,
  loadUserNamesById,
  type DocumentListRow,
} from '@/lib/documents/load-for-viewer'
import type { User, DocumentStep } from '@/types/database'

function getTemplateName(templates: DocumentListRow['templates']): string {
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
  const admin = createAdminClient()

  // Service-role reads: member RLS typically only lets users see documents they
  // initiated, which would hide "Awaiting my action" from assignees.
  const [myDocs, awaitingRows, allDocs] = await Promise.all([
    loadInitiatedDocuments(admin, {
      userId: user.id,
      organisationId: user.organisation_id,
    }),
    loadAwaitingApprovalsForUser({
      userId: user.id,
      organisationId: user.organisation_id,
    }),
    isAdmin ? loadOrganisationDocuments(admin, user.organisation_id) : Promise.resolve(null),
  ])

  const allIds = Array.from(
    new Set([
      ...myDocs.map((doc) => doc.id),
      ...awaitingRows.map((row) => row.documentId),
      ...(allDocs ?? []).map((doc) => doc.id),
    ])
  )
  const initiatorIds = Array.from(
    new Set([
      ...myDocs.map((doc) => doc.initiated_by),
      ...awaitingRows.map((row) => row.document.initiated_by),
      ...(allDocs ?? []).map((doc) => doc.initiated_by),
    ])
  )

  const [stepsByDocument, initiatorNameById] = await Promise.all([
    loadStepProgressByDocument(admin, allIds),
    loadUserNamesById(admin, initiatorIds),
  ])

  function toRow(doc: DocumentListRow): DocumentRow {
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
  const awaitingMyAction: AwaitingDocumentRow[] = awaitingRows.map((row) => ({
    ...toRow(row.document),
    stepId: row.stepId,
    requiresSignature: Boolean(row.signatureFieldId),
  }))
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
