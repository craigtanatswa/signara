import { createAdminClient } from '@/lib/supabase/admin'
import type { Document, DocumentStep, Template } from '@/types/database'

type AdminClient = ReturnType<typeof createAdminClient>

export type DocumentListRow = Pick<
  Document,
  'id' | 'title' | 'status' | 'created_at' | 'initiated_by'
> & {
  templates: { name: string } | { name: string }[] | null
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
}): Promise<AwaitingApprovalRow[]> {
  const admin = createAdminClient()

  const { data: steps, error: stepsError } = await admin
    .from('document_steps')
    .select('id, document_id, signature_field_id')
    .eq('assignee_user_id', input.userId)
    .eq('status', 'pending')

  if (stepsError) {
    console.error('[loadAwaitingApprovalsForUser] steps', stepsError.message)
    return []
  }

  if (!steps?.length) return []

  const documentIds = Array.from(new Set(steps.map((step) => step.document_id)))

  const { data: documents, error: docsError } = await admin
    .from('documents')
    .select('id, title, status, created_at, initiated_by, templates(name)')
    .in('id', documentIds)
    .eq('organisation_id', input.organisationId)
    .eq('status', 'in_progress')

  if (docsError) {
    console.error('[loadAwaitingApprovalsForUser] documents', docsError.message)
    return []
  }

  const documentById = new Map(
    ((documents ?? []) as DocumentListRow[]).map((doc) => [doc.id, doc])
  )

  const rows: AwaitingApprovalRow[] = []
  for (const step of steps) {
    const document = documentById.get(step.document_id)
    if (!document) continue
    rows.push({
      stepId: step.id,
      documentId: step.document_id,
      signatureFieldId: step.signature_field_id,
      document,
    })
  }

  return rows
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
  input: { userId: string; organisationId: string; limit?: number }
): Promise<DocumentListRow[]> {
  const { data, error } = await admin
    .from('documents')
    .select('id, title, status, created_at, initiated_by, templates(name)')
    .eq('organisation_id', input.organisationId)
    .eq('initiated_by', input.userId)
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 100)

  if (error) {
    console.error('[loadInitiatedDocuments]', error.message)
    return []
  }

  return (data ?? []) as DocumentListRow[]
}

/** All org documents (admin list). */
export async function loadOrganisationDocuments(
  admin: AdminClient,
  organisationId: string,
  limit = 100
): Promise<DocumentListRow[]> {
  const { data, error } = await admin
    .from('documents')
    .select('id, title, status, created_at, initiated_by, templates(name)')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[loadOrganisationDocuments]', error.message)
    return []
  }

  return (data ?? []) as DocumentListRow[]
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

  const { data, error } = await admin.from('users').select('id, full_name').in('id', userIds)
  if (error) {
    console.error('[loadUserNamesById]', error.message)
    return map
  }

  for (const row of data ?? []) {
    map.set(row.id, row.full_name)
  }
  return map
}
