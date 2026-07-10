/** Shared HTML shell for Signara transactional emails. */

export function wrapEmailHtml({
  subject,
  heading,
  bodyHtml,
  ctaLabel,
  ctaUrl,
}: {
  subject: string
  heading: string
  bodyHtml: string
  ctaLabel: string
  ctaUrl: string
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
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
                ${escapeHtml(heading)}
              </p>
              ${bodyHtml}
              <table cellpadding="0" cellspacing="0" style="margin-top:28px;margin-bottom:8px;">
                <tr>
                  <td style="border-radius:6px;background-color:#D4AF37;">
                    <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:13px 32px;font-size:15px;font-weight:600;color:#0F2C59;text-decoration:none;border-radius:6px;">
                      ${escapeHtml(ctaLabel)}
                    </a>
                  </td>
                </tr>
              </table>
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
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function emailParagraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4A5568;">${text}</p>`
}
