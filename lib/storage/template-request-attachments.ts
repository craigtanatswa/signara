export const TEMPLATE_REQUEST_ATTACHMENTS_BUCKET = 'template-request-attachments'

export const TEMPLATE_REQUEST_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024

export const TEMPLATE_REQUEST_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const

export type TemplateRequestMime = (typeof TEMPLATE_REQUEST_ALLOWED_MIME_TYPES)[number]

const SIGNED_URL_TTL_SECONDS = 60 * 15

/** Minimum job level allowed to request a department template (senior and above). */
export const TEMPLATE_REQUEST_MIN_JOB_LEVEL = 'senior' as const

export function isTemplateRequestMime(mime: string): mime is TemplateRequestMime {
  return TEMPLATE_REQUEST_ALLOWED_MIME_TYPES.includes(mime as TemplateRequestMime)
}

/**
 * Path for a physical-form scan uploaded with a template request.
 * `requestDraftId` is a client-generated id used before the DB row exists.
 */
export function getTemplateRequestAttachmentPath(
  organisationId: string,
  requestDraftId: string,
  filename: string
): string {
  const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(-120)
  return `${organisationId}/${requestDraftId}/${Date.now()}-${safeName}`
}

export function getTemplateRequestAttachmentFilename(path: string): string {
  const last = path.split('/').pop() ?? path
  return last.replace(/^\d+-/, '')
}

export { SIGNED_URL_TTL_SECONDS }
