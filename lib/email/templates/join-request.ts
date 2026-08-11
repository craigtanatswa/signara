interface JoinApprovedEmailParams {
  recipientName: string
  orgName: string
  loginUrl: string
}

export function buildJoinApprovedEmail({
  recipientName,
  orgName,
  loginUrl,
}: JoinApprovedEmailParams): { subject: string; html: string } {
  const subject = `You're in — welcome to ${orgName} on Signara`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8F9FA;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;border:1px solid #e0e0e0;overflow:hidden;max-width:560px;width:100%;">
          <tr>
            <td style="background-color:#0F2C59;padding:28px 40px;">
              <p style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">Signa<span style="color:#D4AF37;">ra</span></p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F2C59;">Hi ${recipientName},</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4A5568;">
                Your request to join <strong>${orgName}</strong> has been approved. Sign in with the password you created when you applied.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:6px;background-color:#D4AF37;">
                    <a href="${loginUrl}" style="display:inline-block;padding:13px 32px;font-size:15px;font-weight:600;color:#0F2C59;text-decoration:none;">
                      Sign in to Signara
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, html }
}

interface JoinRejectedEmailParams {
  recipientName: string
  orgName: string
}

export function buildJoinRejectedEmail({
  recipientName,
  orgName,
}: JoinRejectedEmailParams): { subject: string; html: string } {
  const subject = `Update on your request to join ${orgName}`

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:40px 20px;background:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="560" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e0e0e0;">
    <tr><td style="background:#0F2C59;padding:24px 40px;"><p style="margin:0;font-size:22px;font-weight:700;color:#fff;">Signa<span style="color:#D4AF37;">ra</span></p></td></tr>
    <tr><td style="padding:32px 40px;">
      <p style="margin:0 0 12px;font-size:18px;font-weight:700;color:#0F2C59;">Hi ${recipientName},</p>
      <p style="margin:0;font-size:15px;line-height:1.6;color:#4A5568;">
        Your request to join <strong>${orgName}</strong> on Signara was not approved. If you think this is a mistake, contact the organisation administrator.
      </p>
    </td></tr>
  </table>
</body>
</html>`

  return { subject, html }
}
