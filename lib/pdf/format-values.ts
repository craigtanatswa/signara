import { format, isValid, parseISO } from 'date-fns'
import { getAttachmentFilename } from '@/lib/storage/document-attachments'

/** Format a stored date field value for PDF display. */
export function formatPdfDateValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (value instanceof Date) {
    return isValid(value) ? format(value, 'd MMMM yyyy') : '—'
  }
  if (typeof value === 'number') {
    const parsed = new Date(value)
    return isValid(parsed) ? format(parsed, 'd MMMM yyyy') : String(value)
  }
  if (typeof value !== 'string') return String(value)

  const fromIso = parseISO(value)
  if (isValid(fromIso)) return format(fromIso, 'd MMMM yyyy')

  const fallback = new Date(value)
  if (isValid(fallback)) return format(fallback, 'd MMMM yyyy')
  return value
}

/** Format a signed-at timestamp for signature blocks. */
export function formatPdfSignedAt(iso: string | null | undefined): string {
  if (!iso) return '—'
  const parsed = parseISO(iso)
  if (!isValid(parsed)) return iso
  return format(parsed, "d MMM yyyy, hh:mm a")
}

/** Format a generic timestamp for the audit trail. */
export function formatPdfAuditTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—'
  const parsed = parseISO(iso)
  if (!isValid(parsed)) return iso
  return format(parsed, 'd MMM yyyy, HH:mm')
}

export function formatPdfFieldValue(
  fieldType: string,
  value: unknown
): string {
  if (value === null || value === undefined || value === '') return '—'

  switch (fieldType) {
    case 'checkbox':
      return value ? 'Yes' : 'No'
    case 'date':
      return formatPdfDateValue(value)
    case 'file':
      return typeof value === 'string'
        ? `[Attached: ${getAttachmentFilename(value)}]`
        : '[Attached file]'
    case 'number':
      return String(value)
    default:
      return String(value)
  }
}

export function documentRefFromId(documentId: string): string {
  return documentId.replace(/-/g, '').slice(0, 8).toUpperCase()
}

export function safePdfFilename(title: string): string {
  const base = title.replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'document'
  return `${base}.pdf`
}

/** Truncate a user-agent string for audit display. */
export function truncateUserAgent(ua: string | null | undefined, max = 72): string {
  if (!ua) return '—'
  const cleaned = ua.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max - 1)}…`
}
