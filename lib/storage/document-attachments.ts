export const DOCUMENT_ATTACHMENTS_BUCKET = 'document-attachments'

export const DOCUMENT_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024

const SIGNED_URL_TTL_SECONDS = 60 * 10

/**
 * Path for a file-field upload collected while a document is still being
 * drafted. `draftId` is a client-generated id (the document row doesn't
 * exist yet at this point in the wizard) — it just needs to be stable and
 * unique per in-progress draft so re-uploads land in the same folder.
 */
export function getDocumentAttachmentPath(
  organisationId: string,
  draftId: string,
  filename: string
): string {
  const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(-120)
  return `${organisationId}/${draftId}/${Date.now()}-${safeName}`
}

export function getAttachmentFilename(path: string): string {
  const last = path.split('/').pop() ?? path
  return last.replace(/^\d+-/, '')
}

export { SIGNED_URL_TTL_SECONDS }
