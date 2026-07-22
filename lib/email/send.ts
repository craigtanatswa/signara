import { resend } from '@/lib/email/resend'
import { getResendFromAddress } from '@/lib/email/config'
import { getAppBaseUrl } from '@/lib/app-url'

export { getAppBaseUrl }

/**
 * Send a transactional email. Failures are logged and never thrown —
 * workflow advancement must not depend on email delivery.
 */
export async function sendTransactionalEmail(input: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY is not set; skipping send:', input.subject)
    return
  }

  if (!input.to) {
    console.warn('[email] No recipient; skipping send:', input.subject)
    return
  }

  try {
    const { error } = await resend.emails.send({
      from: getResendFromAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
    })

    if (error) {
      console.error('[email] Resend error:', error)
    }
  } catch (err) {
    console.error('[email] Failed to send:', err)
  }
}

/** Absolute URL to a document detail page. */
export function getDocumentUrl(documentId: string): string {
  return `${getAppBaseUrl()}/dashboard/documents/${documentId}`
}

/** Absolute URL to the public document verification page. */
export function getVerifyDocumentUrl(documentId: string): string {
  return `${getAppBaseUrl()}/verify/${documentId}`
}
