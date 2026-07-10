import { getDocumentAttachmentSignedUrl } from '@/app/actions/documents'
import { getInitiatorSignatureField } from '@/lib/workflow/signature-fields'
import { listTemplateFieldsWithRoles } from '@/lib/tiptap/field-utils'
import { getAttachmentFilename } from '@/lib/storage/document-attachments'
import type { DocumentStep, TiptapDocument } from '@/types/database'

export interface DocumentPreviewContext {
  fieldValues: Record<string, unknown>
  signaturesByFieldId: Record<string, string | null>
  fileUrlsByFieldId: Record<string, string | null>
}

/** Resolve field values, signature images, and file URLs for the document preview. */
export async function buildDocumentPreviewContext(input: {
  templateContent: TiptapDocument | null
  documentData: Record<string, unknown> | null
  steps: Pick<DocumentStep, 'signature_field_id' | 'status' | 'signature_url'>[]
}): Promise<DocumentPreviewContext> {
  const fieldValues = { ...(input.documentData ?? {}) }
  const signaturesByFieldId: Record<string, string | null> = {}
  const fileUrlsByFieldId: Record<string, string | null> = {}

  const initiatorField = getInitiatorSignatureField(input.templateContent)
  if (initiatorField) {
    const value = fieldValues[initiatorField.fieldId]
    if (typeof value === 'string' && value.startsWith('data:image/')) {
      signaturesByFieldId[initiatorField.fieldId] = value
    }
  }

  for (const step of input.steps) {
    if (
      step.signature_field_id &&
      step.status === 'approved' &&
      typeof step.signature_url === 'string' &&
      step.signature_url.length > 0
    ) {
      signaturesByFieldId[step.signature_field_id] = step.signature_url
    }
  }

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

  return { fieldValues, signaturesByFieldId, fileUrlsByFieldId }
}

export function formatPreviewFileLabel(path: string | null | undefined): string | null {
  if (!path || typeof path !== 'string') return null
  return getAttachmentFilename(path)
}
