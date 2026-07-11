import { getDocumentAttachmentSignedUrl } from '@/app/actions/documents'
import { getInitiatorSignatureField } from '@/lib/workflow/signature-fields'
import { parseStepNotes } from '@/lib/workflow/step-notes'
import { listTemplateFieldsWithRoles } from '@/lib/tiptap/field-utils'
import { getAttachmentFilename } from '@/lib/storage/document-attachments'
import type { DocumentStep, TiptapDocument } from '@/types/database'

export interface DocumentPreviewContext {
  fieldValues: Record<string, unknown>
  signaturesByFieldId: Record<string, string | null>
  /** Signature fields completed via physical / print-and-sign upload. */
  physicalByFieldId: Record<string, boolean>
  fileUrlsByFieldId: Record<string, string | null>
}

function isRasterSignaturePath(path: string): boolean {
  const lower = path.toLowerCase()
  return (
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.gif')
  )
}

/** Resolve field values, signature images, and file URLs for the document preview. */
export async function buildDocumentPreviewContext(input: {
  templateContent: TiptapDocument | null
  documentData: Record<string, unknown> | null
  steps: Pick<DocumentStep, 'signature_field_id' | 'status' | 'signature_url' | 'notes'>[]
}): Promise<DocumentPreviewContext> {
  const fieldValues = { ...(input.documentData ?? {}) }
  const signaturesByFieldId: Record<string, string | null> = {}
  const physicalByFieldId: Record<string, boolean> = {}
  const fileUrlsByFieldId: Record<string, string | null> = {}

  const initiatorField = getInitiatorSignatureField(input.templateContent)
  if (initiatorField) {
    const value = fieldValues[initiatorField.fieldId]
    if (typeof value === 'string' && value.startsWith('data:image/')) {
      signaturesByFieldId[initiatorField.fieldId] = value
    }
  }

  await Promise.all(
    input.steps.map(async (step) => {
      if (
        !step.signature_field_id ||
        step.status !== 'approved' ||
        typeof step.signature_url !== 'string' ||
        !step.signature_url
      ) {
        return
      }

      const notes = parseStepNotes(step.notes)
      const url = step.signature_url

      // Physical / print-and-sign: preview shows APPROVED in the signature slot.
      if (notes.physicalSignature || url === 'physical') {
        physicalByFieldId[step.signature_field_id] = true
        return
      }

      if (url.startsWith('data:image/')) {
        signaturesByFieldId[step.signature_field_id] = url
        return
      }

      // Storage path — only embed raster images; PDF scans treat as physical.
      if (!isRasterSignaturePath(url)) {
        physicalByFieldId[step.signature_field_id] = true
        return
      }

      const signed = await getDocumentAttachmentSignedUrl(url)
      signaturesByFieldId[step.signature_field_id] = 'url' in signed ? signed.url : null
    })
  )

  const fileFields = listTemplateFieldsWithRoles(input.templateContent).filter(
    (field) => field.fieldType === 'file'
  )

  await Promise.all(
    fileFields.map(async (field) => {
      const value = fieldValues[field.fieldId]
      if (typeof value !== 'string' || !value) {
        fileUrlsByFieldId[field.fieldId] = null
        return
      }
      const signed = await getDocumentAttachmentSignedUrl(value)
      fileUrlsByFieldId[field.fieldId] = 'url' in signed ? signed.url : null
    })
  )

  return { fieldValues, signaturesByFieldId, physicalByFieldId, fileUrlsByFieldId }
}

export function formatPreviewFileLabel(path: string | null | undefined): string | null {
  if (!path || typeof path !== 'string') return null
  return getAttachmentFilename(path)
}
