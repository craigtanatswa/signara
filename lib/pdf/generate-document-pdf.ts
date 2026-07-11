import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  DOCUMENT_ATTACHMENTS_BUCKET,
  SIGNED_URL_TTL_SECONDS,
} from '@/lib/storage/document-attachments'
import { resolvePdfImageSrc, resolveOrganisationBrandingForTemplate } from '@/lib/pdf/resolve-pdf-image'
import { ExecutedDocument } from '@/lib/pdf/executed-document'
import { PrintReadyDocument } from '@/lib/pdf/print-ready-document'
// import { generateQrCodeDataUrl } from '@/lib/pdf/components/qr-code'
import {
  AuditTrailDocument,
  mapStepStatusToAuditLabel,
  type AuditTrailStepRow,
} from '@/lib/pdf/components/audit-trail'
import {
  mergePdfBuffers,
  stampUploadedDocument,
  bytesToPdfDocument,
} from '@/lib/pdf/stamp-uploaded-document'
import { parseStepNotes } from '@/lib/workflow/step-notes'
import { getInitiatorSignatureField } from '@/lib/workflow/signature-fields'
import { getCachedPdf, setCachedPdf } from '@/lib/pdf/preview-cache'
import {
  getTemplatePageOrientation,
  getTemplateUsesOrganisationLetterhead,
  getTemplateUsesOrganisationLogo,
} from '@/lib/tiptap/field-utils'
// import { getVerifyDocumentUrl } from '@/lib/email/send'
import { formatUserDisplayName } from '@/lib/users/display-name'
import type {
  Document,
  DocumentStep,
  FieldPosition,
  Organisation,
  Template,
} from '@/types/database'

export function getFinalPdfStoragePath(organisationId: string, documentId: string): string {
  // v2 = template-faithful layout (logo/letterhead/field controls matching on-screen preview)
  return `${organisationId}/${documentId}/final-v2.pdf`
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

  // Public or signed http(s) URLs
  if (/^https?:\/\//i.test(raw)) {
    return resolvePdfImageSrc(raw)
  }

  // Private storage path in document-attachments (e.g. physical signature scan)
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(DOCUMENT_ATTACHMENTS_BUCKET).download(raw)
  if (error || !data) {
    console.error('[resolveSignatureSrc] storage download', error?.message)
    return null
  }

  const buffer = Buffer.from(await data.arrayBuffer())
  const lower = raw.toLowerCase()
  let contentType = data.type || ''
  if (!contentType || contentType === 'application/octet-stream') {
    if (lower.endsWith('.png')) contentType = 'image/png'
    else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) contentType = 'image/jpeg'
    else if (lower.endsWith('.webp')) contentType = 'image/webp'
    else if (lower.endsWith('.gif')) contentType = 'image/gif'
    else if (lower.endsWith('.pdf')) contentType = 'application/pdf'
  }

  // Only embed raster images into signature fields — PDF scans stay as attachments.
  if (!contentType.startsWith('image/')) return null

  // Cap large scan photos so PDF render stays fast.
  try {
    const { createCanvas, loadImage } = await import('@napi-rs/canvas')
    const img = await loadImage(buffer)
    const maxWidth = 800
    if (img.width > maxWidth) {
      const height = Math.max(1, Math.round((img.height * maxWidth) / img.width))
      const canvas = createCanvas(maxWidth, height)
      canvas.getContext('2d').drawImage(img, 0, 0, maxWidth, height)
      const scaled = canvas.toBuffer('image/png')
      return `data:image/png;base64,${scaled.toString('base64')}`
    }
  } catch {
    // Fall through to original bytes.
  }

  return `data:${contentType};base64,${buffer.toString('base64')}`
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

type OrganisationPdfContext = Pick<
  Organisation,
  'id' | 'name' | 'logo_url' | 'letterhead_url' | 'letterhead_landscape_url'
>

async function loadPdfContext(
  documentId: string,
  organisationId: string
): Promise<
  | { error: string }
  | {
      document: Document & { templates: Template | null }
      template: Template
      organisation: OrganisationPdfContext
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

  const [{ data: orgData }, { data: stepsData }] = await Promise.all([
    admin
      .from('organisations')
      .select('id, name, logo_url, letterhead_url, letterhead_landscape_url')
      .eq('id', organisationId)
      .maybeSingle(),
    admin
      .from('document_steps')
      .select('*')
      .eq('document_id', documentId)
      .order('step_order'),
  ])

  if (!orgData) {
    return { error: 'Organisation not found.' }
  }

  const organisation = orgData as OrganisationPdfContext
  const steps = (stepsData ?? []) as DocumentStep[]
  const assigneeIds = Array.from(new Set(steps.map((s) => s.assignee_user_id).filter(Boolean)))

  const [{ data: usersData }, { data: initiator }] = await Promise.all([
    assigneeIds.length > 0
      ? admin.from('users').select('id, full_name, position').in('id', assigneeIds)
      : Promise.resolve({
          data: [] as Array<{ id: string; full_name: string; position: string | null }>,
        }),
    admin
      .from('users')
      .select('full_name, position')
      .eq('id', document.initiated_by)
      .maybeSingle(),
  ])

  const nameById = new Map(
    (usersData ?? []).map((u) => [u.id, formatUserDisplayName(u.full_name, u.position)])
  )

  const stepsWithUsers: StepWithUser[] = steps.map((step) => ({
    ...step,
    full_name: nameById.get(step.assignee_user_id) ?? 'Unknown',
  }))

  return {
    document,
    template,
    organisation,
    steps: stepsWithUsers,
    initiatedByName: initiator
      ? formatUserDisplayName(initiator.full_name, initiator.position)
      : 'Unknown',
  }
}

async function resolveTemplateBranding(
  organisation: OrganisationPdfContext,
  content: Template['content']
) {
  return resolveOrganisationBrandingForTemplate({
    logoUrl: organisation.logo_url,
    letterheadUrl: organisation.letterhead_url,
    letterheadLandscapeUrl: organisation.letterhead_landscape_url,
    useLogo: getTemplateUsesOrganisationLogo(content),
    useLetterhead: getTemplateUsesOrganisationLetterhead(content),
    orientation: getTemplatePageOrientation(content),
  })
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
  organisation: OrganisationPdfContext
  steps: StepWithUser[]
  initiatedByName: string
  includeAuditTrail?: boolean
}): Promise<Buffer> {
  const fieldValues = { ...(input.document.data ?? {}) }
  const signaturesByFieldId: Record<string, string | null> = {}

  const initiatorField = getInitiatorSignatureField(input.template.content)

  const [, organisationBranding] = await Promise.all([
    (async () => {
      if (initiatorField) {
        const raw = fieldValues[initiatorField.fieldId]
        if (typeof raw === 'string') {
          signaturesByFieldId[initiatorField.fieldId] = await resolveSignatureSrc(raw)
        }
      }

      await Promise.all(
        input.steps.map(async (step) => {
          if (!step.signature_field_id || step.status !== 'approved') return
          const src = await resolveSignatureSrc(step.signature_url)
          if (src) {
            signaturesByFieldId[step.signature_field_id] = src
            return
          }
          // Approved physical / non-embeddable scan — show "Physically signed" label.
          const notes = parseStepNotes(step.notes)
          if (notes.physicalSignature || step.signature_url === 'physical' || step.signature_url) {
            fieldValues[step.signature_field_id] = 'physical'
          }
        })
      )
    })(),
    resolveTemplateBranding(input.organisation, input.template.content),
  ])

  const rejectedStep = input.steps.find((s) => s.status === 'rejected')
  const rejectedAt = rejectedStep
    ? parseStepNotes(rejectedStep.notes).rejectedAt ?? rejectedStep.signed_at
    : null

  const includeAuditTrail =
    input.includeAuditTrail ??
    (input.document.status === 'completed' || input.document.status === 'rejected')

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
    organisationBranding,
    organisationName: input.organisation.name,
    fieldValues,
    signaturesByFieldId,
    auditSteps: buildAuditSteps(input.steps),
    initiatedByName: input.initiatedByName,
    rejectedAt,
    includeAuditTrail,
  })

  return renderToBuffer(element as Parameters<typeof renderToBuffer>[0])
}

async function generateUploadedDocumentPdf(input: {
  document: Document
  template: Template
  organisation: OrganisationPdfContext
  steps: StepWithUser[]
  initiatedByName: string
  includeAuditTrail?: boolean
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

  if (input.includeAuditTrail === false) {
    return stamped
  }

  const auditBuffer = await renderAuditTrailBuffer({
    document: input.document,
    template: input.template,
    organisation: input.organisation,
    steps: input.steps,
    initiatedByName: input.initiatedByName,
  })

  // Audit trail first; stamped source document follows on subsequent pages.
  return mergePdfBuffers(auditBuffer, stamped)
}

/**
 * Generate (or reuse) the PDF for a document the caller already has access to.
 */
export async function generateDocumentPdf(input: {
  documentId: string
  organisationId: string
  /** When true, skip the stored final PDF even if present. */
  forceRegenerate?: boolean
  /**
   * When false, omit the audit-trail page so the PDF matches the on-screen
   * document preview. Defaults to including it for completed/rejected docs.
   */
  includeAuditTrail?: boolean
}): Promise<GenerateDocumentPdfResult | { error: string }> {
  const loaded = await loadPdfContext(input.documentId, input.organisationId)
  if ('error' in loaded) return loaded

  const { document, template, organisation, steps, initiatedByName } = loaded
  const filename = `${(document.title || template.name || 'document')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim() || 'document'}.pdf`

  const cachedPath = document.final_pdf_url
  const isTemplateFaithfulCache =
    typeof cachedPath === 'string' && cachedPath.includes('final-v2.pdf')

  if (
    !input.forceRegenerate &&
    input.includeAuditTrail !== false &&
    document.status === 'completed' &&
    isTemplateFaithfulCache &&
    cachedPath
  ) {
    const cached = await downloadStoredFinalPdf(cachedPath)
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
          includeAuditTrail:
            input.includeAuditTrail ??
            (document.status === 'completed' || document.status === 'rejected'),
        })

    // Refresh the immutable final when we regenerated a completed document with audit trail.
    if (
      document.status === 'completed' &&
      input.includeAuditTrail !== false &&
      !isUploaded
    ) {
      await storeFinalDocumentPdf({
        organisationId: input.organisationId,
        documentId: input.documentId,
        buffer,
      }).catch((err) => console.error('[generateDocumentPdf] refresh final', err))
    }

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

function resolvePhysicalSignaturePath(
  document: Document,
  steps: DocumentStep[]
): string | null {
  if (document.physical_signature_url) return document.physical_signature_url

  const physicalStep = [...steps]
    .sort((a, b) => b.step_order - a.step_order)
    .find((step) => {
      if (step.status !== 'approved') return false
      const notes = parseStepNotes(step.notes)
      const url = step.signature_url
      if (!notes.physicalSignature || !url) return false
      if (url.startsWith('data:image/') || url === 'physical') return false
      return true
    })

  return physicalStep?.signature_url ?? null
}

async function renderAuditTrailBuffer(input: {
  document: Document
  template: Template
  organisation: OrganisationPdfContext
  steps: StepWithUser[]
  initiatedByName: string
}): Promise<Buffer> {
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

  return renderToBuffer(auditElement as Parameters<typeof renderToBuffer>[0])
}

/**
 * Audit trail first, then the approved document body on a fresh page.
 * Prefers the physically signed upload when present; otherwise the digital PDF.
 */
export async function generateAuditTrailBundlePdf(input: {
  documentId: string
  organisationId: string
}): Promise<GenerateDocumentPdfResult | { error: string }> {
  const loaded = await loadPdfContext(input.documentId, input.organisationId)
  if ('error' in loaded) return loaded

  const { document, template, organisation, steps, initiatedByName } = loaded
  const filename = `${(document.title || template.name || 'document')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim() || 'document'}-audit-trail.pdf`

  try {
    const auditBuffer = await renderAuditTrailBuffer({
      document,
      template,
      organisation,
      steps,
      initiatedByName,
    })

    const physicalPath = resolvePhysicalSignaturePath(document, steps)
    let documentBody: Buffer

    if (physicalPath) {
      const admin = createAdminClient()
      const { data, error } = await admin.storage
        .from(DOCUMENT_ATTACHMENTS_BUCKET)
        .download(physicalPath)

      if (error || !data) {
        console.error('[generateAuditTrailBundlePdf] physical download', error?.message)
        return { error: 'Could not load the approved document for the audit trail.' }
      }

      const bytes = Buffer.from(await data.arrayBuffer())
      documentBody = await bytesToPdfDocument(bytes, {
        contentType: data.type || undefined,
        path: physicalPath,
      })
    } else {
      const isUploaded =
        template.template_type === 'uploaded_document' &&
        Boolean(template.source_file_url) &&
        Array.isArray(template.field_positions)

      documentBody = isUploaded
        ? await generateUploadedDocumentPdf({
            document,
            template,
            organisation,
            steps,
            initiatedByName,
            includeAuditTrail: false,
          })
        : await generateTiptapPdf({
            document,
            template,
            organisation,
            steps,
            initiatedByName,
            includeAuditTrail: false,
          })
    }

    const buffer = await mergePdfBuffers(auditBuffer, documentBody)
    return { buffer, filename, fromCache: false }
  } catch (err) {
    console.error('[generateAuditTrailBundlePdf]', err)
    return {
      error: err instanceof Error ? err.message : 'Failed to generate audit trail PDF.',
    }
  }
}

/**
 * Generate a print-and-sign PDF for the final assignee: prior signatures visible,
 * final signature field left blank, QR verification code on page 1.
 */
export async function generatePrintReadyDocumentPdf(input: {
  documentId: string
  organisationId: string
}): Promise<GenerateDocumentPdfResult | { error: string }> {
  const loaded = await loadPdfContext(input.documentId, input.organisationId)
  if ('error' in loaded) return loaded

  const { document, template, organisation, steps } = loaded

  const actionableSteps = steps.filter((s) => s.status !== 'skipped')
  const finalStep = actionableSteps[actionableSteps.length - 1]
  if (!finalStep) {
    return { error: 'No approval steps found for this document.' }
  }

  const filename = `${(document.title || template.name || 'document')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim() || 'document'}-print-and-sign.pdf`

  const cacheKey = [
    'print-ready',
    document.id,
    document.updated_at,
    ...steps.map((s) => `${s.id}:${s.status}:${s.signed_at ?? ''}:${s.signature_url ?? ''}`),
  ].join('|')

  const cached = getCachedPdf(cacheKey)
  if (cached) {
    return { buffer: cached.buffer, filename: cached.filename ?? filename, fromCache: true }
  }

  const isUploaded =
    template.template_type === 'uploaded_document' &&
    Boolean(template.source_file_url) &&
    Array.isArray(template.field_positions)

  try {
    const buffer = isUploaded
      ? await generateUploadedPrintReadyPdf({
          document,
          template,
          organisation,
          steps,
          finalStep,
        })
      : await generateTiptapPrintReadyPdf({
          document,
          template,
          organisation,
          steps,
          finalStep,
        })

    setCachedPdf(cacheKey, buffer, filename)
    return { buffer, filename, fromCache: false }
  } catch (err) {
    console.error('[generatePrintReadyDocumentPdf]', err)
    return {
      error: err instanceof Error ? err.message : 'Failed to generate print-ready PDF.',
    }
  }
}

async function generateTiptapPrintReadyPdf(input: {
  document: Document
  template: Template
  organisation: OrganisationPdfContext
  steps: StepWithUser[]
  finalStep: StepWithUser
}): Promise<Buffer> {
  const fieldValues = { ...(input.document.data ?? {}) }
  const signaturesByFieldId: Record<string, string | null> = {}
  const printReadyEmptySignatures: Record<
    string,
    { assigneeName: string; roleLabel: string }
  > = {}

  const initiatorField = getInitiatorSignatureField(input.template.content)

  const [, organisationBranding] = await Promise.all([
    (async () => {
      if (initiatorField) {
        const raw = fieldValues[initiatorField.fieldId]
        if (typeof raw === 'string') {
          signaturesByFieldId[initiatorField.fieldId] = await resolveSignatureSrc(raw)
        }
      }

      await Promise.all(
        input.steps.map(async (step) => {
          if (!step.signature_field_id) return

          if (step.id === input.finalStep.id) {
            const notes = parseStepNotes(step.notes)
            printReadyEmptySignatures[step.signature_field_id] = {
              assigneeName: step.full_name ?? 'Signatory',
              roleLabel: notes.authorityText ?? '',
            }
            return
          }

          if (step.status !== 'approved') return
          const src = await resolveSignatureSrc(step.signature_url)
          if (src) {
            signaturesByFieldId[step.signature_field_id] = src
          } else if (parseStepNotes(step.notes).physicalSignature || step.signature_url) {
            fieldValues[step.signature_field_id] = 'physical'
          }
        })
      )
    })(),
    resolveTemplateBranding(input.organisation, input.template.content),
  ])

  // QR code temporarily disabled on print-ready downloads
  // const qrCodeSrc = await generateQrCodeDataUrl(getVerifyDocumentUrl(input.document.id))

  const element = createElement(PrintReadyDocument, {
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
    organisationBranding,
    organisationName: input.organisation.name,
    fieldValues,
    signaturesByFieldId,
    printReadyEmptySignatures,
    // qrCodeSrc,
  })

  return renderToBuffer(element as Parameters<typeof renderToBuffer>[0])
}

async function generateUploadedPrintReadyPdf(input: {
  document: Document
  template: Template
  organisation: OrganisationPdfContext
  steps: StepWithUser[]
  finalStep: StepWithUser
}): Promise<Buffer> {
  const sourceFileUrl = input.template.source_file_url
  if (!sourceFileUrl) {
    throw new Error('Uploaded document template is missing source_file_url.')
  }

  const fieldPositions = (input.template.field_positions ?? []) as FieldPosition[]
  const fieldValues = { ...(input.document.data ?? {}) }
  const signatureImages: Record<string, string | null> = {}
  const finalFieldId = input.finalStep.signature_field_id

  const initiatorField = fieldPositions.find(
    (f) => f.fieldType === 'signature' && f.signatureRole === 'initiator'
  )

  const [, resolvedSource] = await Promise.all([
    (async () => {
      if (initiatorField) {
        const raw = fieldValues[initiatorField.fieldId]
        if (typeof raw === 'string') {
          signatureImages[initiatorField.fieldId] = await resolveSignatureSrc(raw)
        }
      }

      await Promise.all(
        input.steps.map(async (step) => {
          if (!step.signature_field_id || step.status !== 'approved') return
          if (step.id === input.finalStep.id) return
          signatureImages[step.signature_field_id] = await resolveSignatureSrc(step.signature_url)
        })
      )
    })(),
    resolveSourceFileUrl(sourceFileUrl),
  ])

  const stamped = await stampUploadedDocument({
    sourceFileUrl: resolvedSource,
    fieldPositions: fieldPositions.filter((f) => f.fieldId !== finalFieldId),
    fieldValues,
    signatureImages,
  })

  // Overlay final signature label and footer via pdf-lib.
  // QR code and sign-here box temporarily disabled.
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdfDoc = await PDFDocument.load(stamped)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const pages = pdfDoc.getPages()
  const firstPage = pages[0]
  if (!firstPage) throw new Error('Print-ready PDF has no pages.')

  // QR code temporarily disabled
  // const qrDataUrl = await generateQrCodeDataUrl(getVerifyDocumentUrl(input.document.id))
  // const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '')
  // const qrImage = await pdfDoc.embedPng(Buffer.from(qrBase64, 'base64'))
  // const { width: pageWidth, height: pageHeight } = firstPage.getSize()
  // firstPage.drawImage(qrImage, {
  //   x: pageWidth - 88,
  //   y: pageHeight - 88,
  //   width: 64,
  //   height: 64,
  // })

  if (finalFieldId) {
    const finalField = fieldPositions.find((f) => f.fieldId === finalFieldId)
    if (finalField && finalField.page >= 0 && finalField.page < pages.length) {
      const page = pages[finalField.page]
      const { width: pw, height: ph } = page.getSize()
      const { percentToPdfPoints } = await import('@/lib/templates/coordinate-utils')
      const { pdfX, pdfY, pdfHeight } = percentToPdfPoints(finalField, pw, ph)
      // Field label only — box and assignee name temporarily removed.
      page.drawText(finalField.label || 'Signature', {
        x: pdfX,
        y: pdfY + Math.max(pdfHeight, 14),
        size: 9,
        font: bold,
        color: rgb(0.06, 0.17, 0.35),
      })
    }
  }

  const footer = 'This document was partially digitally signed via Signara.'
  for (const page of pages) {
    const { width } = page.getSize()
    page.drawText(footer, {
      x: 40,
      y: 18,
      size: 6,
      font,
      color: rgb(0.63, 0.66, 0.63),
      maxWidth: width - 80,
    })
  }

  const bytes = await pdfDoc.save()
  return Buffer.from(bytes)
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
    .select('id, organisation_id, role, department_id, job_level')
    .eq('id', authUser.id)
    .single()

  if (!profile) {
    return { error: 'Unauthorized', status: 401 }
  }

  const { data: document } = await admin
    .from('documents')
    .select(
      'id, initiated_by, organisation_id, status, templates(department_id, archive_department_id)'
    )
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

  if (isInitiator || isAssignee || isOrgAdmin) {
    return { organisationId: profile.organisation_id, userId: profile.id }
  }

  // Archive viewers (department overseers / managing directors) may open completed docs.
  if (document.status === 'completed') {
    const { managingDirectorOverseesAllDepartments, getVisibleMemberDepartmentIds } =
      await import('@/lib/org-structure/overseen-departments')
    const { loadOverseenDepartmentIdsByUser } = await import('@/lib/org-structure/load-overseen')
    const { isJobLevel } = await import('@/types/org-structure')

    const jobLevel = isJobLevel(profile.job_level) ? profile.job_level : 'staff'
    if (managingDirectorOverseesAllDepartments(jobLevel)) {
      return { organisationId: profile.organisation_id, userId: profile.id }
    }

    const overseenByUser = await loadOverseenDepartmentIdsByUser(
      admin,
      profile.organisation_id
    )
    const controlledIds = new Set(
      getVisibleMemberDepartmentIds({
        department_id: profile.department_id,
        job_level: jobLevel,
        overseen_department_ids: overseenByUser.get(profile.id) ?? [],
      })
    )

    const templatesRaw = (document as { templates?: unknown }).templates
    const template = Array.isArray(templatesRaw) ? templatesRaw[0] : templatesRaw
    const departmentId =
      template && typeof template === 'object'
        ? ((template as { archive_department_id?: string | null; department_id?: string | null })
            .archive_department_id ??
            (template as { department_id?: string | null }).department_id ??
            null)
        : null

    // Org-wide archive (no department) is visible to anyone with archive access.
    if (!departmentId || controlledIds.has(departmentId)) {
      return { organisationId: profile.organisation_id, userId: profile.id }
    }
  }

  return { error: 'Forbidden', status: 403 }
}

