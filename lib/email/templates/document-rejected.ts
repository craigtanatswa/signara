import { emailParagraph, escapeHtml, wrapEmailHtml } from '@/lib/email/templates/layout'

interface RejectionEmailParams {
  initiatorName: string
  documentTitle: string
  rejectedByName: string
  reason: string
  documentUrl: string
}

export function buildRejectionEmail({
  initiatorName,
  documentTitle,
  rejectedByName,
  reason,
  documentUrl,
}: RejectionEmailParams): { subject: string; html: string } {
  const subject = `${documentTitle} was rejected`

  const bodyHtml =
    emailParagraph(
      `Hi ${escapeHtml(initiatorName)}, your <strong>${escapeHtml(documentTitle)}</strong> was rejected by ${escapeHtml(rejectedByName)}.`
    ) +
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4A5568;padding:12px 16px;background-color:#FEF2F2;border-left:3px solid #DC2626;border-radius:0 4px 4px 0;">
      <strong style="color:#0F2C59;">Reason:</strong> ${escapeHtml(reason)}
    </p>`

  const html = wrapEmailHtml({
    subject,
    heading: 'Document rejected',
    bodyHtml,
    ctaLabel: 'View document',
    ctaUrl: documentUrl,
  })

  return { subject, html }
}
