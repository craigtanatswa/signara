import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/header'
import { DashboardPageBody } from '@/components/layout/dashboard-page-body'
import { Button } from '@/components/ui/button'
import {
  DocumentsTabs,
  type DocumentRow,
  type AwaitingDocumentRow,
} from '@/components/documents/documents-tabs'
import { DocumentFilters } from '@/components/documents/document-filters'
import { Plus } from 'lucide-react'
import {
  countAwaitingApprovalsForUser,
  loadAwaitingApprovalsForUser,
  loadInitiatedDocuments,
  loadOrganisationDocuments,
  loadStepProgressByDocument,
  loadUserNamesById,
  type DocumentListRow,
} from '@/lib/documents/load-for-viewer'
import {
  documentFiltersActive,
  parseDocumentListFilters,
} from '@/lib/documents/document-filters'
import { formatUserDisplayName } from '@/lib/users/display-name'
import type { User, DocumentStep } from '@/types/database'

interface DocumentsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

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

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
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
  const params = await searchParams

  // Prefetch awaiting badge count so we can pick a sensible default tab
  const awaitingBadgeCount = await countAwaitingApprovalsForUser({
    userId: user.id,
    organisationId: user.organisation_id,
    showArchived: false,
  })

  const filters = parseDocumentListFilters(params, {
    isAdmin,
    defaultTab: awaitingBadgeCount > 0 ? 'awaiting' : 'mine',
  })
  const filtersActive = documentFiltersActive(filters)

  // Service-role reads: member RLS typically only lets users see documents they
  // initiated, which would hide "Awaiting my action" from assignees.
  const [myDocsResult, awaitingResult, allDocsResult, templatesResult, usersResult] =
    await Promise.all([
      loadInitiatedDocuments(admin, {
        userId: user.id,
        organisationId: user.organisation_id,
        filters,
      }),
      loadAwaitingApprovalsForUser({
        userId: user.id,
        organisationId: user.organisation_id,
        filters,
      }),
      isAdmin
        ? loadOrganisationDocuments(admin, user.organisation_id, filters)
        : Promise.resolve(null),
      admin
        .from('templates')
        .select('id, name')
        .eq('organisation_id', user.organisation_id)
        .order('name'),
      isAdmin
        ? admin
            .from('users')
            .select('id, full_name, position')
            .eq('organisation_id', user.organisation_id)
            .order('full_name')
        : Promise.resolve({ data: null }),
    ])

  const allIds = Array.from(
    new Set([
      ...myDocsResult.rows.map((doc) => doc.id),
      ...awaitingResult.rows.map((row) => row.documentId),
      ...(allDocsResult?.rows ?? []).map((doc) => doc.id),
    ])
  )
  const initiatorIds = Array.from(
    new Set([
      ...myDocsResult.rows.map((doc) => doc.initiated_by),
      ...awaitingResult.rows.map((row) => row.document.initiated_by),
      ...(allDocsResult?.rows ?? []).map((doc) => doc.initiated_by),
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
      archived: Boolean(doc.archived),
      stepProgress:
        doc.status === 'in_progress' ? buildStepProgress(stepsByDocument.get(doc.id) ?? []) : null,
    }
  }

  const myDocuments = {
    rows: myDocsResult.rows.map(toRow),
    total: myDocsResult.total,
  }
  const awaitingMyAction = {
    rows: awaitingResult.rows.map(
      (row): AwaitingDocumentRow => ({
        ...toRow(row.document),
        stepId: row.stepId,
        requiresSignature: Boolean(row.signatureFieldId),
      })
    ),
    total: awaitingResult.total,
  }
  const allDocuments = allDocsResult
    ? { rows: allDocsResult.rows.map(toRow), total: allDocsResult.total }
    : null

  const filterTemplates = (templatesResult.data ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
  }))
  const filterUsers = ((usersResult.data ?? []) as Array<{
    id: string
    full_name: string
    position: string | null
  }>).map((u) => ({
    id: u.id,
    name: formatUserDisplayName(u.full_name, u.position),
  }))

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

          <Suspense
            fallback={
              <div className="h-28 animate-pulse rounded-lg border border-signara-steel/30 bg-white shadow-sm" />
            }
          >
            <DocumentFilters
              templates={filterTemplates}
              users={filterUsers}
              showInitiatedBy={isAdmin}
            />
          </Suspense>

          <Suspense
            fallback={
              <div className="h-64 animate-pulse rounded-lg border border-signara-steel/30 bg-white shadow-sm" />
            }
          >
            <DocumentsTabs
              myDocuments={myDocuments}
              awaitingMyAction={awaitingMyAction}
              allDocuments={allDocuments}
              awaitingBadgeCount={awaitingBadgeCount}
              page={filters.page}
              filtersActive={filtersActive}
              defaultTab={filters.tab}
              selectionResetKey={[
                filters.tab,
                filters.page,
                filters.search,
                filters.templateIds.join(','),
                filters.statuses.join(','),
                filters.dateFrom ?? '',
                filters.dateTo ?? '',
                filters.initiatedBy ?? '',
                filters.showArchived ? '1' : '0',
                myDocuments.rows.map((r) => r.id).join(','),
                awaitingMyAction.rows.map((r) => r.id).join(','),
                (allDocuments?.rows ?? []).map((r) => r.id).join(','),
              ].join('|')}
            />
          </Suspense>
        </div>
      </DashboardPageBody>
    </>
  )
}
