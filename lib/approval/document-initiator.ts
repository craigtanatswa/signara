import type { Document, DocumentStep, TiptapDocument } from '@/types/database'
import { getInitiatorSignatureField } from '@/lib/workflow/signature-fields'

export function canInitiatorEditDocument(
  document: Pick<Document, 'status' | 'initiated_by'>,
  currentUserId: string
): boolean {
  return document.status === 'draft' && document.initiated_by === currentUserId
}

export function canInitiatorCancelDocument(
  document: Pick<Document, 'status' | 'initiated_by'>,
  steps: Pick<DocumentStep, 'status'>[],
  currentUserId: string
): boolean {
  if (document.initiated_by !== currentUserId) return false
  if (document.status === 'draft' || document.status === 'rejected') return true
  if (document.status === 'in_progress') {
    return !steps.some((step) => step.status === 'approved')
  }
  return false
}

export function getInitiatorSignatureFromData(
  data: Record<string, unknown> | null | undefined,
  fieldId: string
): string | null {
  const value = data?.[fieldId]
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** Returns an error message when the template requires an initiator signature that is missing. */
export function getMissingInitiatorSignatureError(
  templateContent: TiptapDocument | null,
  data: Record<string, unknown> | null | undefined
): string | null {
  const field = getInitiatorSignatureField(templateContent)
  if (!field) return null
  if (!getInitiatorSignatureFromData(data, field.fieldId)) {
    return 'Your initiator signature is required before this document can be submitted.'
  }
  return null
}
