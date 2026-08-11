interface ConfirmSignupEmailParams {
  recipientName: string
  email: string
  confirmUrl: string
  organisationName: string
}

export function buildConfirmSignupEmail({
  recipientName,
  email,
  confirmUrl,
  organisationName,
}: ConfirmSignupEmailParams): { subject: string; html: string } {
  const subject = 'Confirm your Signara account'

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
              <p style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                Signa<span style="color:#D4AF37;">ra</span>
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F2C59;">
                Confirm your email
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4A5568;">
                Hi ${recipientName}, thanks for creating a Signara account for
                <strong style="color:#0F2C59;">${organisationName}</strong>
                (${email}). Click the button below to verify your email and finish setup.
              </p>

              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="border-radius:6px;background-color:#D4AF37;">
                    <a href="${confirmUrl}" style="display:inline-block;padding:13px 32px;font-size:15px;font-weight:600;color:#0F2C59;text-decoration:none;border-radius:6px;">
                      Verify email
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 12px;font-size:13px;color:#718096;line-height:1.5;">
                If the button doesn&apos;t work, copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 24px;font-size:12px;line-height:1.5;word-break:break-all;color:#0F2C59;">
                ${confirmUrl}
              </p>

              <p style="margin:0;font-size:13px;color:#718096;line-height:1.5;padding:12px 16px;background-color:#FFFBEB;border-left:3px solid #D4AF37;border-radius:0 4px 4px 0;">
                If you didn&apos;t create a Signara account, you can ignore this email.
              </p>
            </td>
          </tr>

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
