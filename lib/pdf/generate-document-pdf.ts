import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  DOCUMENT_ATTACHMENTS_BUCKET,
  SIGNED_URL_TTL_SECONDS,
} from '@/lib/storage/document-attachments'
import { resolvePdfImageSrc } from '@/lib/pdf/resolve-pdf-image'
import { ExecutedDocument } from '@/lib/pdf/executed-document'
import {
  AuditTrailDocument,
  mapStepStatusToAuditLabel,
  type AuditTrailStepRow,
} from '@/lib/pdf/components/audit-trail'
import type { SignatureBlockEntry } from '@/lib/pdf/components/signature-block'
import {
  mergePdfBuffers,
  stampUploadedDocument,
} from '@/lib/pdf/stamp-uploaded-document'
import { parseStepNotes } from '@/lib/workflow/step-notes'
import { getInitiatorSignatureField } from '@/lib/workflow/signature-fields'
import type {
  Document,
  DocumentStep,
  FieldPosition,
  Organisation,
  Template,
} from '@/types/database'

export function getFinalPdfStoragePath(organisationId: string, documentId: string): string {
  return `${organisationId}/${documentId}/final.pdf`
}

type StepWithUser = DocumentStep & {
  full_name?: string | null
}

export interface GenerateDocumentPdfResult {
  buffer: Buffer
  filename: string
  fromCache: boolean
}

async function resolveSignatureSrc(raw: string | null | undefined): Promise<string | null> {
  if (!raw) return null
  if (raw === 'physical') return null
  if (raw.startsWith('data:image/')) return raw
  return resolvePdfImageSrc(raw)
}

function buildAuditSteps(steps: StepWithUser[]): AuditTrailStepRow[] {
  return steps.map((step) => {
    const notes = parseStepNotes(step.notes)
    const timestamp =
      step.status === 'rejected'
        ? notes.rejectedAt ?? step.signed_at
        : step.signed_at

    return {
      stepOrder: step.step_order,
      assigneeName: step.full_name ?? 'Unknown',
      authorityText: notes.authorityText ?? '',
      statusLabel: mapStepStatusToAuditLabel(step.status),
      timestamp: timestamp ?? null,
      ipAddress: notes.signerIp ?? null,
      userAgent: notes.userAgent ?? null,
    }
  })
}

function buildSignatureEntries(
  steps: StepWithUser[],
  imagesByStepId: Record<string, string | null>
): SignatureBlockEntry[] {
  return steps.map((step) => {
    const notes = parseStepNotes(step.notes)
    const isPhysical =
      notes.physicalSignature === true || step.signature_url === 'physical'

    return {
      stepOrder: step.step_order,
      fullName: step.full_name ?? 'Unknown',
      authorityText: notes.authorityText ?? null,
      signedAt: step.signed_at,
      imageSrc: imagesByStepId[step.id] ?? null,
      isPhysical,
      status: step.status,
    }
  })
}

async function loadPdfContext(
  documentId: string,
  organisationId: string
): Promise<
  | { error: string }
  | {
      document: Document & { templates: Template | null }
      template: Template
      organisation: Pick<Organisation, 'id' | 'name' | 'logo_url'>
      steps: StepWithUser[]
      initiatedByName: string
    }
> {
  const admin = createAdminClient()

  const { data: documentData, error: docError } = await admin
    .from('documents')
    .select('*, templates(*)')
    .eq('id', documentId)
    .eq('organisation_id', organisationId)
    .maybeSingle()

  if (docError || !documentData) {
    return { error: 'Document not found.' }
  }

  const document = documentData as Document & { templates: Template | null }
  const template = document.templates
  if (!template) {
    return { error: 'Template not found for this document.' }
  }

  const { data: orgData } = await admin
    .from('organisations')
    .select('id, name, logo_url')
    .eq('id', organisationId)
    .maybeSingle()

  if (!orgData) {
    return { error: 'Organisation not found.' }
  }

  const organisation = orgData as Pick<Organisation, 'id' | 'name' | 'logo_url'>

  const { data: stepsData } = await admin
    .from('document_steps')
    .select('*')
    .eq('document_id', documentId)
    .order('step_order')

  const steps = (stepsData ?? []) as DocumentStep[]
  const assigneeIds = Array.from(new Set(steps.map((s) => s.assignee_user_id).filter(Boolean)))

  const { data: usersData } =
    assigneeIds.length > 0
      ? await admin.from('users').select('id, full_name').in('id', assigneeIds)
      : { data: [] as Array<{ id: string; full_name: string }> }

  const nameById = new Map((usersData ?? []).map((u) => [u.id, u.full_name]))

  const stepsWithUsers: StepWithUser[] = steps.map((step) => ({
    ...step,
    full_name: nameById.get(step.assignee_user_id) ?? 'Unknown',
  }))

  const { data: initiator } = await admin
    .from('users')
    .select('full_name')
    .eq('id', document.initiated_by)
    .maybeSingle()

  return {
    document,
    template,
    organisation,
    steps: stepsWithUsers,
    initiatedByName: initiator?.full_name ?? 'Unknown',
  }
}

async function downloadStoredFinalPdf(pathOrUrl: string): Promise<Buffer | null> {
  const admin = createAdminClient()

  // Prefer storage download when we have a bucket-relative path.
  const isHttp = /^https?:\/\//i.test(pathOrUrl)
  if (!isHttp) {
    const { data, error } = await admin.storage
      .from(DOCUMENT_ATTACHMENTS_BUCKET)
      .download(pathOrUrl)
    if (error || !data) {
      console.error('[downloadStoredFinalPdf]', error?.message)
      return null
    }
    return Buffer.from(await data.arrayBuffer())
  }

  try {
    const response = await fetch(pathOrUrl)
    if (!response.ok) return null
    return Buffer.from(await response.arrayBuffer())
  } catch {
    return null
  }
}

/**
 * Upload the immutable final PDF and return the storage path stored on the document.
 */
export async function storeFinalDocumentPdf(input: {
  organisationId: string
  documentId: string
  buffer: Buffer
}): Promise<string | null> {
  const admin = createAdminClient()
  const path = getFinalPdfStoragePath(input.organisationId, input.documentId)

  const { error: uploadError } = await admin.storage
    .from(DOCUMENT_ATTACHMENTS_BUCKET)
    .upload(path, input.buffer, {
      upsert: true,
      contentType: 'application/pdf',
      cacheControl: '31536000',
    })

  if (uploadError) {
    console.error('[storeFinalDocumentPdf] upload', uploadError.message)
    return null
  }

  const { error: updateError } = await admin
    .from('documents')
    .update({
      final_pdf_url: path,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.documentId)
    .eq('organisation_id', input.organisationId)

  if (updateError) {
    console.error('[storeFinalDocumentPdf] update', updateError.message)
    return null
  }

  return path
}

async function resolveSourceFileUrl(sourceFileUrl: string): Promise<string> {
  // Public http(s) URLs and data URLs can be fetched directly.
  if (/^(https?:|data:)/i.test(sourceFileUrl)) return sourceFileUrl

  // Treat as a private storage path in document-attachments (or organisation assets).
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(DOCUMENT_ATTACHMENTS_BUCKET)
    .createSignedUrl(sourceFileUrl, SIGNED_URL_TTL_SECONDS)

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? 'Could not resolve source PDF URL.')
  }
  return data.signedUrl
}

async function generateTiptapPdf(input: {
  document: Document
  template: Template
  organisation: Pick<Organisation, 'id' | 'name' | 'logo_url'>
  steps: StepWithUser[]
  initiatedByName: string
}): Promise<Buffer> {
  const fieldValues = { ...(input.document.data ?? {}) }
  const signaturesByFieldId: Record<string, string | null> = {}

  const initiatorField = getInitiatorSignatureField(input.template.content)
  if (initiatorField) {
    const raw = fieldValues[initiatorField.fieldId]
    if (typeof raw === 'string') {
      signaturesByFieldId[initiatorField.fieldId] = await resolveSignatureSrc(raw)
    }
  }

  const imagesByStepId: Record<string, string | null> = {}
  await Promise.all(
    input.steps.map(async (step) => {
      const src = await resolveSignatureSrc(step.signature_url)
      imagesByStepId[step.id] = src
      if (step.signature_field_id && step.status === 'approved' && src) {
        signaturesByFieldId[step.signature_field_id] = src
      }
    })
  )

  const logoSrc = await resolvePdfImageSrc(input.organisation.logo_url)

  const rejectedStep = input.steps.find((s) => s.status === 'rejected')
  const rejectedAt = rejectedStep
    ? parseStepNotes(rejectedStep.notes).rejectedAt ?? rejectedStep.signed_at
    : null

  const element = createElement(ExecutedDocument, {
    document: {
      id: input.document.id,
      title: input.document.title,
      status: input.document.status,
      data: input.document.data,
      created_at: input.document.created_at,
      completed_at: input.document.completed_at,
    },
    template: {
      name: input.template.name,
      content: input.template.content,
    },
    organisation: {
      name: input.organisation.name,
      logo_url: input.organisation.logo_url,
      logoSrc,
    },
    fieldValues,
    signaturesByFieldId,
    signatureEntries: buildSignatureEntries(input.steps, imagesByStepId),
    auditSteps: buildAuditSteps(input.steps),
    initiatedByName: input.initiatedByName,
    rejectedAt,
  })

  return renderToBuffer(element as Parameters<typeof renderToBuffer>[0])
}

async function generateUploadedDocumentPdf(input: {
  document: Document
  template: Template
  organisation: Pick<Organisation, 'id' | 'name' | 'logo_url'>
  steps: StepWithUser[]
  initiatedByName: string
}): Promise<Buffer> {
  const sourceFileUrl = input.template.source_file_url
  if (!sourceFileUrl) {
    throw new Error('Uploaded document template is missing source_file_url.')
  }

  const fieldPositions = (input.template.field_positions ?? []) as FieldPosition[]
  const fieldValues = { ...(input.document.data ?? {}) }
  const signatureImages: Record<string, string | null> = {}

  const initiatorField = fieldPositions.find(
    (f) => f.fieldType === 'signature' && f.signatureRole === 'initiator'
  )
  if (initiatorField) {
    const raw = fieldValues[initiatorField.fieldId]
    if (typeof raw === 'string') {
      signatureImages[initiatorField.fieldId] = await resolveSignatureSrc(raw)
    }
  }

  await Promise.all(
    input.steps.map(async (step) => {
      if (!step.signature_field_id || step.status !== 'approved') return
      signatureImages[step.signature_field_id] = await resolveSignatureSrc(step.signature_url)
    })
  )

  // Also map any remaining signature fields from document.data
  for (const field of fieldPositions) {
    if (field.fieldType !== 'signature') continue
    if (signatureImages[field.fieldId]) continue
    const raw = fieldValues[field.fieldId]
    if (typeof raw === 'string') {
      signatureImages[field.fieldId] = await resolveSignatureSrc(raw)
    }
  }

  const resolvedSource = await resolveSourceFileUrl(sourceFileUrl)
  const stamped = await stampUploadedDocument({
    sourceFileUrl: resolvedSource,
    fieldPositions,
    fieldValues,
    signatureImages,
  })

  const logoSrc = await resolvePdfImageSrc(input.organisation.logo_url)
  const rejectedStep = input.steps.find((s) => s.status === 'rejected')
  const rejectedAt = rejectedStep
    ? parseStepNotes(rejectedStep.notes).rejectedAt ?? rejectedStep.signed_at
    : null

  const auditElement = createElement(AuditTrailDocument, {
    organisationName: input.organisation.name,
    logoSrc,
    documentTitle: input.document.title || input.template.name,
    documentId: input.document.id,
    initiatedByName: input.initiatedByName,
    initiatedAt: input.document.created_at,
    completedAt: input.document.completed_at,
    rejectedAt,
    documentStatus: input.document.status,
    steps: buildAuditSteps(input.steps),
  })

  const auditBuffer = await renderToBuffer(
    auditElement as Parameters<typeof renderToBuffer>[0]
  )
  return mergePdfBuffers(stamped, auditBuffer)
}

/**
 * Generate (or reuse) the PDF for a document the caller already has access to.
 */
export async function generateDocumentPdf(input: {
  documentId: string
  organisationId: string
  /** When true, skip the stored final PDF even if present. */
  forceRegenerate?: boolean
}): Promise<GenerateDocumentPdfResult | { error: string }> {
  const loaded = await loadPdfContext(input.documentId, input.organisationId)
  if ('error' in loaded) return loaded

  const { document, template, organisation, steps, initiatedByName } = loaded
  const filename = `${(document.title || template.name || 'document')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim() || 'document'}.pdf`

  if (
    !input.forceRegenerate &&
    document.status === 'completed' &&
    document.final_pdf_url
  ) {
    const cached = await downloadStoredFinalPdf(document.final_pdf_url)
    if (cached) {
      return { buffer: cached, filename, fromCache: true }
    }
  }

  const isUploaded =
    template.template_type === 'uploaded_document' &&
    Boolean(template.source_file_url) &&
    Array.isArray(template.field_positions)

  try {
    const buffer = isUploaded
      ? await generateUploadedDocumentPdf({
          document,
          template,
          organisation,
          steps,
          initiatedByName,
        })
      : await generateTiptapPdf({
          document,
          template,
          organisation,
          steps,
          initiatedByName,
        })

    return { buffer, filename, fromCache: false }
  } catch (err) {
    console.error('[generateDocumentPdf]', err)
    return {
      error: err instanceof Error ? err.message : 'Failed to generate PDF.',
    }
  }
}

/**
 * Generate the final PDF after completion and persist it. Failures are logged
 * but do not fail the approval action.
 */
export async function generateAndStoreFinalPdf(input: {
  documentId: string
  organisationId: string
}): Promise<void> {
  const result = await generateDocumentPdf({
    documentId: input.documentId,
    organisationId: input.organisationId,
    forceRegenerate: true,
  })

  if ('error' in result) {
    console.error('[generateAndStoreFinalPdf]', result.error)
    return
  }

  await storeFinalDocumentPdf({
    organisationId: input.organisationId,
    documentId: input.documentId,
    buffer: result.buffer,
  })
}

/** Verify the current session user can access the document (same rules as the viewer). */
export async function assertDocumentPdfAccess(documentId: string): Promise<
  | { organisationId: string; userId: string }
  | { error: string; status: number }
> {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    return { error: 'Unauthorized', status: 401 }
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('id, organisation_id, role')
    .eq('id', authUser.id)
    .single()

  if (!profile) {
    return { error: 'Unauthorized', status: 401 }
  }

  const { data: document } = await admin
    .from('documents')
    .select('id, initiated_by, organisation_id')
    .eq('id', documentId)
    .eq('organisation_id', profile.organisation_id)
    .maybeSingle()

  if (!document) {
    return { error: 'Document not found', status: 404 }
  }

  const { data: steps } = await admin
    .from('document_steps')
    .select('assignee_user_id')
    .eq('document_id', documentId)

  const isInitiator = document.initiated_by === profile.id
  const isAssignee = (steps ?? []).some((s) => s.assignee_user_id === profile.id)
  const isOrgAdmin = profile.role === 'admin'

  if (!isInitiator && !isAssignee && !isOrgAdmin) {
    return { error: 'Forbidden', status: 403 }
  }

  return { organisationId: profile.organisation_id, userId: profile.id }
}
