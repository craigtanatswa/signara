import { emailParagraph, escapeHtml, wrapEmailHtml } from '@/lib/email/templates/layout'

interface PasswordResetEmailParams {
  recipientName: string
  orgName: string
  email: string
  tempPassword: string
  loginUrl: string
  adminName?: string
}

export function buildPasswordResetEmail({
  recipientName,
  orgName,
  email,
  tempPassword,
  loginUrl,
  adminName,
}: PasswordResetEmailParams): { subject: string; html: string } {
  const subject = 'Your Signara password has been reset'

  const resetByLine = adminName
    ? `${escapeHtml(adminName)} reset your password for <strong>${escapeHtml(orgName)}</strong> on Signara.`
    : `Your password for <strong>${escapeHtml(orgName)}</strong> on Signara has been reset.`

  const credentialsBox = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8F9FA;border:1px solid #e0e0e0;border-radius:6px;margin-bottom:8px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#0F2C59;text-transform:uppercase;letter-spacing:0.5px;">Your login credentials</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;font-size:14px;color:#718096;width:140px;">Email</td>
              <td style="padding:6px 0;font-size:14px;color:#0F2C59;font-weight:500;">${escapeHtml(email)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:14px;color:#718096;">Temporary password</td>
              <td style="padding:6px 0;font-size:14px;color:#0F2C59;font-weight:500;font-family:monospace;letter-spacing:0.5px;">${escapeHtml(tempPassword)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#718096;line-height:1.5;padding:12px 16px;background-color:#FFFBEB;border-left:3px solid #D4AF37;border-radius:0 4px 4px 0;">
      You'll be asked to create a new password when you sign in.
    </p>`

  const html = wrapEmailHtml({
    subject,
    heading: `Hi ${recipientName},`,
    bodyHtml: `${emailParagraph(resetByLine)}${emailParagraph('Sign in using the temporary credentials below.')}${credentialsBox}`,
    ctaLabel: 'Sign in to Signara',
    ctaUrl: loginUrl,
  })

  return { subject, html }
}
