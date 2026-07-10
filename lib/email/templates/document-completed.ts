import { emailParagraph, escapeHtml, wrapEmailHtml } from '@/lib/email/templates/layout'

interface CompletionEmailParams {
  recipientName: string
  documentTitle: string
  documentUrl: string
}

export function buildCompletionEmail({
  recipientName,
  documentTitle,
  documentUrl,
}: CompletionEmailParams): { subject: string; html: string } {
  const subject = `${documentTitle} is fully approved`

  const bodyHtml = emailParagraph(
    `Hi ${escapeHtml(recipientName)}, your <strong>${escapeHtml(documentTitle)}</strong> has been approved by everyone in the chain and is now complete.`
  )

  const html = wrapEmailHtml({
    subject,
    heading: 'Document fully approved',
    bodyHtml,
    ctaLabel: 'View final document',
    ctaUrl: documentUrl,
  })

  return { subject, html }
}
