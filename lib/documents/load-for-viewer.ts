import { createAdminClient } from '@/lib/supabase/admin'
import {
  dateToExclusiveUpperBound,
  paginationRange,
  type DocumentListFilters,
} from '@/lib/documents/document-filters'
import { formatUserDisplayName } from '@/lib/users/display-name'
import type { Document, DocumentStep, Template } from '@/types/database'

type AdminClient = ReturnType<typeof createAdminClient>

export type DocumentListRow = Pick<
  Document,
  'id' | 'title' | 'status' | 'created_at' | 'initiated_by' | 'archived'
> & {
  templates: { name: string } | { name: string }[] | null
}

export type DocumentListResult = {
  rows: DocumentListRow[]
  total: number
}

type DocumentFilterInput = Pick<
  DocumentListFilters,
  | 'search'
  | 'templateIds'
  | 'statuses'
  | 'dateFrom'
  | 'dateTo'
  | 'initiatedBy'
  | 'showArchived'
  | 'page'
>

/** Apply shared list filters to a documents query builder. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyDocumentListFilters(query: any, filters: DocumentFilterInput) {
  let next = query

  if (!filters.showArchived) {
    // Include false and null (legacy rows); exclude only explicitly archived.
    next = next.or('archived.eq.false,archived.is.null')
  }

  if (filters.search) {
    next = next.ilike('title', `%${filters.search}%`)
  }
  if (filters.templateIds.length > 0) {
    next = next.in('template_id', filters.templateIds)
  }
  if (filters.statuses.length > 0) {
    next = next.in('status', filters.statuses)
  }
  if (filters.dateFrom) {
    next = next.gte('created_at', `${filters.dateFrom}T00:00:00.000Z`)
  }
  if (filters.dateTo) {
    next = next.lt('created_at', dateToExclusiveUpperBound(filters.dateTo))
  }
  if (filters.initiatedBy) {
    next = next.eq('initiated_by', filters.initiatedBy)
  }

  return next
}

export type AwaitingApprovalRow = {
  stepId: string
  documentId: string
  signatureFieldId: string | null
  document: DocumentListRow
}

/**
 * Pending approval steps assigned to this user, with parent documents.
 * Uses the service-role client so RLS that only allows initiators to read
 * documents does not hide work from assignees.
 */
export async function loadAwaitingApprovalsForUser(input: {
  userId: string
  organisationId: string
  filters?: DocumentFilterInput
}): Promise<{ rows: AwaitingApprovalRow[]; total: number }> {
  const admin = createAdminClient()
  const filters = input.filters

  const { data: steps, error: stepsError } = await admin
    .from('document_steps')
    .select('id, document_id, signature_field_id')
    .eq('assignee_user_id', input.userId)
    .eq('status', 'pending')

  if (stepsError) {
    console.error('[loadAwaitingApprovalsForUser] steps', stepsError.message)
    return { rows: [], total: 0 }
  }

  if (!steps?.length) return { rows: [], total: 0 }

  const documentIds = Array.from(new Set(steps.map((step) => step.document_id)))

  let docsQuery = admin
    .from('documents')
    .select('id, title, status, created_at, initiated_by, archived, templates(name)')
    .in('id', documentIds)
    .eq('organisation_id', input.organisationId)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })

  if (filters) {
    // Status filter: awaiting is always in_progress — if user filtered to other
    // statuses only, return empty. If in_progress is included (or no status filter), keep.
    if (filters.statuses.length > 0 && !filters.statuses.includes('in_progress')) {
      return { rows: [], total: 0 }
    }
    docsQuery = applyDocumentListFilters(docsQuery, {
      ...filters,
      // Already constrained to in_progress above
      statuses: [],
    })
  }

  const { data: documents, error: docsError } = await docsQuery

  if (docsError) {
    console.error('[loadAwaitingApprovalsForUser] documents', docsError.message)
    return { rows: [], total: 0 }
  }

  const documentById = new Map(
    ((documents ?? []) as DocumentListRow[]).map((doc) => [doc.id, doc])
  )

  const allRows: AwaitingApprovalRow[] = []
  for (const step of steps) {
    const document = documentById.get(step.document_id)
    if (!document) continue
    allRows.push({
      stepId: step.id,
      documentId: step.document_id,
      signatureFieldId: step.signature_field_id,
      document,
    })
  }

  // Sort by document created_at desc to match other lists
  allRows.sort(
    (a, b) =>
      new Date(b.document.created_at).getTime() - new Date(a.document.created_at).getTime()
  )

  const total = allRows.length
  if (!filters) {
    return { rows: allRows, total }
  }

  const { start, pageSize } = paginationRange(filters.page)
  return { rows: allRows.slice(start, start + pageSize), total }
}

/**
 * Load a document for a viewer who is initiator, assignee, or org admin.
 * Returns null when the document is missing or the user has no access.
 */
export async function loadDocumentForViewer(input: {
  documentId: string
  userId: string
  organisationId: string
  role: 'admin' | 'member'
}): Promise<{
  document: Document & { templates: Pick<Template, 'name' | 'content'> | null }
  steps: DocumentStep[]
} | null> {
  const admin = createAdminClient()

  const { data: documentData, error: docError } = await admin
    .from('documents')
    .select('*, templates(name, content)')
    .eq('id', input.documentId)
    .eq('organisation_id', input.organisationId)
    .maybeSingle()

  if (docError) {
    console.error('[loadDocumentForViewer]', docError.message)
    return null
  }
  if (!documentData) return null

  const document = documentData as Document & {
    templates: Pick<Template, 'name' | 'content'> | null
  }

  const { data: stepsData, error: stepsError } = await admin
    .from('document_steps')
    .select('*')
    .eq('document_id', input.documentId)
    .order('step_order')

  if (stepsError) {
    console.error('[loadDocumentForViewer] steps', stepsError.message)
  }

  const steps = (stepsData ?? []) as DocumentStep[]
  const isInitiator = document.initiated_by === input.userId
  const isAssignee = steps.some((step) => step.assignee_user_id === input.userId)
  const isOrgAdmin = input.role === 'admin'

  if (!isInitiator && !isAssignee && !isOrgAdmin) {
    return null
  }

  return { document, steps }
}

/** Documents initiated by the user (org-scoped). */
export async function loadInitiatedDocuments(
  admin: AdminClient,
  input: {
    userId: string
    organisationId: string
    filters?: DocumentFilterInput
    limit?: number
  }
): Promise<DocumentListResult> {
  const filters = input.filters
  const { start, end, pageSize } = filters
    ? paginationRange(filters.page)
    : { start: 0, end: (input.limit ?? 100) - 1, pageSize: input.limit ?? 100 }

  let query = admin
    .from('documents')
    .select('id, title, status, created_at, initiated_by, archived, templates(name)', {
      count: 'exact',
    })
    .eq('organisation_id', input.organisationId)
    .eq('initiated_by', input.userId)
    .order('created_at', { ascending: false })
    .range(start, end)

  if (filters) {
    query = applyDocumentListFilters(query, filters)
  }

  const { data, error, count } = await query

  if (error) {
    console.error('[loadInitiatedDocuments]', error.message)
    return { rows: [], total: 0 }
  }

  return {
    rows: (data ?? []) as DocumentListRow[],
    total: count ?? (data?.length ?? 0),
  }
}

/** All org documents (admin list). */
export async function loadOrganisationDocuments(
  admin: AdminClient,
  organisationId: string,
  filters?: DocumentFilterInput,
  limit = 100
): Promise<DocumentListResult> {
  const { start, end } = filters
    ? paginationRange(filters.page)
    : { start: 0, end: limit - 1 }

  let query = admin
    .from('documents')
    .select('id, title, status, created_at, initiated_by, archived, templates(name)', {
      count: 'exact',
    })
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false })
    .range(start, end)

  if (filters) {
    query = applyDocumentListFilters(query, filters)
  }

  const { data, error, count } = await query

  if (error) {
    console.error('[loadOrganisationDocuments]', error.message)
    return { rows: [], total: 0 }
  }

  return {
    rows: (data ?? []) as DocumentListRow[],
    total: count ?? (data?.length ?? 0),
  }
}

/** Lightweight awaiting count for the tab badge (ignores list filters except archived). */
export async function countAwaitingApprovalsForUser(input: {
  userId: string
  organisationId: string
  showArchived?: boolean
}): Promise<number> {
  const result = await loadAwaitingApprovalsForUser({
    ...input,
    filters: {
      search: '',
      templateIds: [],
      statuses: [],
      dateFrom: null,
      dateTo: null,
      initiatedBy: null,
      showArchived: input.showArchived ?? false,
      page: 1,
    },
  })
  return result.total
}

export async function loadStepProgressByDocument(
  admin: AdminClient,
  documentIds: string[]
): Promise<Map<string, Pick<DocumentStep, 'step_order' | 'status'>[]>> {
  const map = new Map<string, Pick<DocumentStep, 'step_order' | 'status'>[]>()
  if (documentIds.length === 0) return map

  const { data, error } = await admin
    .from('document_steps')
    .select('document_id, step_order, status')
    .in('document_id', documentIds)

  if (error) {
    console.error('[loadStepProgressByDocument]', error.message)
    return map
  }

  for (const step of data ?? []) {
    const list = map.get(step.document_id) ?? []
    list.push(step)
    map.set(step.document_id, list)
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.step_order - b.step_order)
  }
  return map
}

export async function loadUserNamesById(
  admin: AdminClient,
  userIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (userIds.length === 0) return map

  const { data, error } = await admin
    .from('users')
    .select('id, full_name, position')
    .in('id', userIds)
  if (error) {
    console.error('[loadUserNamesById]', error.message)
    return map
  }

  for (const row of data ?? []) {
    map.set(row.id, formatUserDisplayName(row.full_name, row.position))
  }
  return map
}

export type ArchivedDocumentRow = {
  id: string
  title: string
  status: Document['status']
  completed_at: string | null
  created_at: string
  initiated_by: string
  final_pdf_url: string | null
  physical_signature_url: string | null
  archived: boolean
  templateName: string
  departmentId: string | null
  departmentName: string | null
}

/**
 * Completed / archived documents whose template is filed under the given departments
 * (via archive_department_id, falling back to access department_id for older rows).
 * Org-wide templates with no archive department are visible to anyone with archive access.
 */
export async function loadArchivedDocuments(
  admin: AdminClient,
  input: {
    organisationId: string
    /** When null/empty and seeAll is false, returns nothing. */
    departmentIds: string[] | null
    seeAll: boolean
    limit?: number
  }
): Promise<ArchivedDocumentRow[]> {
  const { data, error } = await admin
    .from('documents')
    .select(
      'id, title, status, completed_at, created_at, initiated_by, final_pdf_url, physical_signature_url, archived, templates(name, department_id, archive_department_id, archive_department:departments!templates_archive_department_id_fkey(id, name), access_department:departments!templates_department_id_fkey(id, name))'
    )
    .eq('organisation_id', input.organisationId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(input.limit ?? 200)

  if (error) {
    console.error('[loadArchivedDocuments]', error.message)
    return []
  }

  const allowed = input.seeAll
    ? null
    : new Set(input.departmentIds ?? [])

  const rows: ArchivedDocumentRow[] = []
  for (const raw of data ?? []) {
    const templatesRaw = (raw as { templates?: unknown }).templates
    const template = Array.isArray(templatesRaw) ? templatesRaw[0] : templatesRaw
    const templateObj =
      template && typeof template === 'object'
        ? (template as {
            name?: string
            department_id?: string | null
            archive_department_id?: string | null
            archive_department?:
              | { id: string; name: string }
              | { id: string; name: string }[]
              | null
            access_department?:
              | { id: string; name: string }
              | { id: string; name: string }[]
              | null
          })
        : null

    const departmentId =
      templateObj?.archive_department_id ?? templateObj?.department_id ?? null
    const archiveDeptRaw = templateObj?.archive_department
    const accessDeptRaw = templateObj?.access_department
    const archiveDept = Array.isArray(archiveDeptRaw) ? archiveDeptRaw[0] : archiveDeptRaw
    const accessDept = Array.isArray(accessDeptRaw) ? accessDeptRaw[0] : accessDeptRaw
    const dept = archiveDept ?? accessDept

    // Org-wide archive (no department) is visible to anyone with archive access.
    if (allowed && departmentId && !allowed.has(departmentId)) {
      continue
    }

    rows.push({
      id: String((raw as { id: string }).id),
      title: String((raw as { title: string }).title),
      status: (raw as { status: Document['status'] }).status,
      completed_at: (raw as { completed_at: string | null }).completed_at,
      created_at: String((raw as { created_at: string }).created_at),
      initiated_by: String((raw as { initiated_by: string }).initiated_by),
      final_pdf_url: (raw as { final_pdf_url?: string | null }).final_pdf_url ?? null,
      physical_signature_url:
        (raw as { physical_signature_url?: string | null }).physical_signature_url ?? null,
      archived: Boolean((raw as { archived?: boolean }).archived),
      templateName: templateObj?.name ?? 'Unknown template',
      departmentId,
      departmentName: dept?.name ?? (departmentId ? null : 'Organisation-wide'),
    })
  }

  // Backfill physical scan paths from final steps when the document column is empty
  // (docs completed before physical_signature_url existed).
  const needsPhysical = rows.filter((row) => !row.physical_signature_url).map((row) => row.id)
  if (needsPhysical.length > 0) {
    const { data: stepsData } = await admin
      .from('document_steps')
      .select('document_id, signature_url, notes, step_order')
      .in('document_id', needsPhysical)
      .eq('status', 'approved')
      .order('step_order', { ascending: false })

    const physicalByDoc = new Map<string, string>()
    for (const step of stepsData ?? []) {
      if (physicalByDoc.has(step.document_id)) continue
      const notes = typeof step.notes === 'string' ? step.notes : ''
      const url = typeof step.signature_url === 'string' ? step.signature_url : null
      if (!url || url.startsWith('data:image/') || url === 'physical') continue
      if (notes.includes('"physicalSignature":true')) {
        physicalByDoc.set(step.document_id, url)
      }
    }

    for (const row of rows) {
      if (!row.physical_signature_url) {
        row.physical_signature_url = physicalByDoc.get(row.id) ?? null
      }
    }
  }

  return rows
}
