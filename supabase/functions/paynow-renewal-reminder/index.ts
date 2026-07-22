/**
 * paynow-renewal-reminder — Supabase Edge Function
 *
 * Emails admins of Paynow-paying orgs whose plan renewal is due within 3 days,
 * and creates an in-app billing notification.
 *
 * ## Scheduling
 *
 * Example pg_cron + pg_net (run in SQL editor after enabling extensions):
 *
 *   select cron.schedule(
 *     'paynow-renewal-reminder',
 *     '0 8 * * *',
 *     $$
 *     select net.http_post(
 *       url := 'https://<PROJECT_REF>.supabase.co/functions/v1/paynow-renewal-reminder',
 *       headers := jsonb_build_object(
 *         'Content-Type', 'application/json',
 *         'Authorization', 'Bearer ' || '<SERVICE_ROLE_KEY>'
 *       ),
 *       body := '{}'::jsonb
 *     );
 *     $$
 *   );
 *
 * Required secrets:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
 *   RESEND_FROM_EMAIL (optional), APP_URL (or NEXT_PUBLIC_APP_URL)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')
    if (!supabaseUrl) {
      return json({ error: 'SUPABASE_URL is not configured' }, 500)
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const now = new Date()
    const threeDaysOut = new Date(now)
    threeDaysOut.setDate(now.getDate() + 3)

    const { data: orgs, error: orgsError } = await supabase
      .from('organisations')
      .select('id, name, paynow_renewal_date, plan_id')
      .eq('payment_method', 'paynow')
      .eq('subscription_status', 'active')
      .lte('paynow_renewal_date', threeDaysOut.toISOString())
      .gte('paynow_renewal_date', now.toISOString())

    if (orgsError) {
      console.error('[paynow-renewal-reminder] query failed', orgsError.message)
      return json({ error: orgsError.message }, 500)
    }

    const appUrl = (
      Deno.env.get('APP_URL') ??
      Deno.env.get('NEXT_PUBLIC_APP_URL') ??
      'https://signaraflow.com'
    ).replace(/\/$/, '')

    let processed = 0

    for (const org of orgs ?? []) {
      const { data: admin } = await supabase
        .from('users')
        .select('id, email, full_name')
        .eq('organisation_id', org.id)
        .eq('role', 'admin')
        .limit(1)
        .maybeSingle()

      if (!admin) continue

      const renewalDate = new Date(org.paynow_renewal_date)
      const daysLeft = Math.ceil((renewalDate.getTime() - now.getTime()) / 86400000)
      const formatted = renewalDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })

      await sendResendEmail({
        to: admin.email,
        subject: `Your Signara subscription renews in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
        html: buildRenewalEmail({
          adminName: admin.full_name,
          orgName: org.name,
          formatted,
          renewUrl: `${appUrl}/dashboard/settings/billing`,
        }),
      })

      await supabase.from('notifications').insert({
        user_id: admin.id,
        type: 'billing',
        title: 'Subscription renewal due',
        message: `Your plan renews on ${formatted}. Tap to renew via Paynow.`,
        read: false,
      })

      processed += 1
    }

    return json({ processed, total: orgs?.length ?? 0 })
  } catch (err) {
    console.error('[paynow-renewal-reminder]', err)
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildRenewalEmail(input: {
  adminName: string
  orgName: string
  formatted: string
  renewUrl: string
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background-color:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8F9FA;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;border:1px solid #e0e0e0;max-width:560px;width:100%;">
        <tr><td style="background:#0F2C59;padding:28px 40px;">
          <p style="margin:0;font-size:24px;font-weight:700;color:#fff;">Signa<span style="color:#D4AF37;">ra</span></p>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F2C59;">Subscription renewal</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4A5568;">
            Hi ${escapeHtml(input.adminName)},
          </p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4A5568;">
            Your <strong>${escapeHtml(input.orgName)}</strong> subscription is due on
            <strong>${escapeHtml(input.formatted)}</strong>.
          </p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4A5568;">
            Since you pay via EcoCash/Paynow, renewal isn&apos;t automatic — please log in and renew before your access expires.
          </p>
          <a href="${escapeHtml(input.renewUrl)}" style="display:inline-block;padding:13px 32px;font-size:15px;font-weight:600;color:#0F2C59;text-decoration:none;border-radius:6px;background:#D4AF37;">
            Renew now
          </a>
          <p style="margin:24px 0 0;font-size:13px;color:#666;">
            Signara · Document workflows for modern organisations
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

async function sendResendEmail(input: { to: string; subject: string; html: string }) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    console.warn('[paynow-renewal-reminder] RESEND_API_KEY missing; skipping email')
    return
  }

  const from = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Signara <onboarding@resend.dev>'

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
    })

    if (!res.ok) {
      console.error('[paynow-renewal-reminder] Resend error', await res.text())
    }
  } catch (err) {
    console.error('[paynow-renewal-reminder] email failed', err)
  }
}
