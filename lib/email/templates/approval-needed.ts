import { emailParagraph, escapeHtml, wrapEmailHtml } from '@/lib/email/templates/layout'

interface ApprovalNeededEmailParams {
  approverName: string
  documentTitle: string
  initiatorName: string
  orgName: string
  documentUrl: string
  authorityText: string
  /** When true, subject is prefixed with "Reminder: ". */
  isReminder?: boolean
}

export function buildApprovalNeededEmail({
  approverName,
  documentTitle,
  initiatorName,
  orgName,
  documentUrl,
  authorityText,
  isReminder = false,
}: ApprovalNeededEmailParams): { subject: string; html: string } {
  const subjectBase = `Action needed: ${documentTitle}`
  const subject = isReminder ? `Reminder: ${subjectBase}` : subjectBase

  const roleLine = authorityText
    ? ` Your role: <strong>${escapeHtml(authorityText)}</strong>.`
    : ''

  const bodyHtml =
    emailParagraph(
      `Hi ${escapeHtml(approverName)}, ${escapeHtml(initiatorName)} has submitted a <strong>${escapeHtml(documentTitle)}</strong> that needs your approval.${roleLine}`
    ) +
    emailParagraph(
      `This request is for <strong>${escapeHtml(orgName)}</strong> on Signara.`
    )

  const html = wrapEmailHtml({
    subject,
    heading: isReminder ? 'Reminder: approval needed' : 'Approval needed',
    bodyHtml,
    ctaLabel: 'Review and sign',
    ctaUrl: documentUrl,
  })

  return { subject, html }
}
