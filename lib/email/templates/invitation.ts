interface InvitationEmailParams {
  recipientName: string
  orgName: string
  email: string
  tempPassword: string
  loginUrl: string
  inviterName?: string
}

export function buildInvitationEmail({
  recipientName,
  orgName,
  email,
  tempPassword,
  loginUrl,
  inviterName,
}: InvitationEmailParams): { subject: string; html: string } {
  const subject = `You've been invited to ${orgName} on Signara`

  const addedByLine = inviterName
    ? `${inviterName} has added you to <strong>${orgName}</strong> on Signara.`
    : `You've been added to <strong>${orgName}</strong> on Signara.`

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

          <!-- Header -->
          <tr>
            <td style="background-color:#0F2C59;padding:28px 40px;">
              <p style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                Signa<span style="color:#D4AF37;">ra</span>
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F2C59;">
                Hi ${recipientName},
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4A5568;">
                ${addedByLine} You can sign in using the temporary credentials below.
              </p>

              <!-- Credentials box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8F9FA;border:1px solid #e0e0e0;border-radius:6px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#0F2C59;text-transform:uppercase;letter-spacing:0.5px;">Your login credentials</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#718096;width:140px;">Email</td>
                        <td style="padding:6px 0;font-size:14px;color:#0F2C59;font-weight:500;">${email}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#718096;">Temporary password</td>
                        <td style="padding:6px 0;font-size:14px;color:#0F2C59;font-weight:500;font-family:monospace;letter-spacing:0.5px;">${tempPassword}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="border-radius:6px;background-color:#D4AF37;">
                    <a href="${loginUrl}" style="display:inline-block;padding:13px 32px;font-size:15px;font-weight:600;color:#0F2C59;text-decoration:none;border-radius:6px;">
                      Sign in to Signara
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Note -->
              <p style="margin:0;font-size:13px;color:#718096;line-height:1.5;padding:12px 16px;background-color:#FFFBEB;border-left:3px solid #D4AF37;border-radius:0 4px 4px 0;">
                You'll be asked to create a new password when you first sign in.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #e0e0e0;">
              <p style="margin:0;font-size:12px;color:#A1A8A2;text-align:center;">
                Signara &middot; Document workflows for modern organisations
              </p>
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
