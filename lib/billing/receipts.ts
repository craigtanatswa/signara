import { createAdminClient } from '@/lib/supabase/admin'
import { sendTransactionalEmail } from '@/lib/email/send'
import { wrapEmailHtml, escapeHtml, emailParagraph } from '@/lib/email/templates/layout'
import { getAppBaseUrl } from '@/lib/app-url'

export async function rememberReceiptEmail(userId: string, email: string): Promise<void> {
  const normalised = email.trim().toLowerCase()
  if (!normalised) return

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  await supabase.from('users').update({ billing_receipt_email: normalised }).eq('id', userId)

  const { data: existing } = await supabase
    .from('billing_receipt_emails')
    .select('id')
    .eq('user_id', userId)
    .eq('email', normalised)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('billing_receipt_emails')
      .update({ last_used_at: now })
      .eq('id', existing.id)
  } else {
    await supabase.from('billing_receipt_emails').insert({
      user_id: userId,
      email: normalised,
      last_used_at: now,
    })
  }
}

export async function listReceiptEmails(userId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('billing_receipt_emails')
    .select('email')
    .eq('user_id', userId)
    .order('last_used_at', { ascending: false })
    .limit(10)

  return (data ?? []).map((row) => row.email as string)
}

export async function sendPaymentReceipt(input: {
  to: string
  fullName: string
  organisationName: string
  planName: string
  amount: number
  currency: string
  method: 'ecocash' | 'card'
  reference: string
  paynowReference: string | null
  paidAt: Date
}): Promise<void> {
  const methodLabel = input.method === 'ecocash' ? 'EcoCash' : 'Card (Paynow)'
  const formattedAmount = `${input.currency} ${input.amount.toFixed(2)}`
  const paidAt = input.paidAt.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const subject = `Receipt: Signara ${input.planName} subscription`
  const bodyHtml = [
    emailParagraph(`Hi ${escapeHtml(input.fullName)},`),
    emailParagraph(
      `Thank you for your payment. Your <strong>${escapeHtml(input.organisationName)}</strong> organisation is now on the <strong>${escapeHtml(input.planName)}</strong> plan.`
    ),
    `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:1px solid #e0e0e0;border-radius:6px;">
      <tr><td style="padding:12px 16px;font-size:14px;color:#4A5568;border-bottom:1px solid #e0e0e0;">Amount</td><td style="padding:12px 16px;font-size:14px;font-weight:600;color:#0F2C59;border-bottom:1px solid #e0e0e0;text-align:right;">${escapeHtml(formattedAmount)}</td></tr>
      <tr><td style="padding:12px 16px;font-size:14px;color:#4A5568;border-bottom:1px solid #e0e0e0;">Payment method</td><td style="padding:12px 16px;font-size:14px;color:#0F2C59;border-bottom:1px solid #e0e0e0;text-align:right;">${escapeHtml(methodLabel)}</td></tr>
      <tr><td style="padding:12px 16px;font-size:14px;color:#4A5568;border-bottom:1px solid #e0e0e0;">Date</td><td style="padding:12px 16px;font-size:14px;color:#0F2C59;border-bottom:1px solid #e0e0e0;text-align:right;">${escapeHtml(paidAt)}</td></tr>
      <tr><td style="padding:12px 16px;font-size:14px;color:#4A5568;border-bottom:1px solid #e0e0e0;">Reference</td><td style="padding:12px 16px;font-size:13px;color:#0F2C59;border-bottom:1px solid #e0e0e0;text-align:right;word-break:break-all;">${escapeHtml(input.reference)}</td></tr>
      ${
        input.paynowReference
          ? `<tr><td style="padding:12px 16px;font-size:14px;color:#4A5568;">Paynow reference</td><td style="padding:12px 16px;font-size:13px;color:#0F2C59;text-align:right;word-break:break-all;">${escapeHtml(input.paynowReference)}</td></tr>`
          : ''
      }
    </table>`,
    emailParagraph('Keep this email as your payment receipt.'),
  ].join('')

  await sendTransactionalEmail({
    to: input.to,
    subject,
    html: wrapEmailHtml({
      subject,
      heading: 'Payment receipt',
      bodyHtml,
      ctaLabel: 'View billing',
      ctaUrl: `${getAppBaseUrl()}/dashboard/settings/billing`,
    }),
  })
}
