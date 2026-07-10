/**
 * send-reminders — Supabase Edge Function
 *
 * Finds document_steps that are currently pending (matching the parent
 * document's active step), whose deadline (created_at + deadlineHours from
 * step notes) has passed, and that have not already received a reminder
 * today. Sends a Reminder: approval-needed email and updates
 * last_reminder_sent_at.
 *
 * ## Scheduling
 *
 * Set up a Supabase Cron job (Database → Cron Jobs in the dashboard) to run
 * this Edge Function every hour using pg_cron, or use an external scheduler
 * like cron-job.org hitting the function's HTTP endpoint.
 *
 * Example pg_cron + pg_net (run in SQL editor after enabling extensions):
 *
 *   select cron.schedule(
 *     'send-approval-reminders',
 *     '0 * * * *',
 *     $$
 *     select net.http_post(
 *       url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
 *       headers := jsonb_build_object(
 *         'Content-Type', 'application/json',
 *         'Authorization', 'Bearer ' || '<SERVICE_ROLE_KEY>'
 *       ),
 *       body := '{}'::jsonb
 *     );
 *     $$
 *   );
 *
 * Required secrets (supabase secrets set):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
 *   RESEND_FROM_EMAIL (optional), APP_URL (or NEXT_PUBLIC_APP_URL)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const DEFAULT_DEADLINE_HOURS = 48

interface StepNotes {
  deadlineHours?: number
  authorityText?: string
}

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

    const { data: pendingSteps, error: stepsError } = await supabase
      .from('document_steps')
      .select(
        `
        id,
        document_id,
        step_order,
        assignee_user_id,
        status,
        notes,
        created_at,
        updated_at,
        last_reminder_sent_at,
        documents!inner (
          id,
          title,
          status,
          organisation_id,
          initiated_by,
          current_step
        )
      `
      )
      .eq('status', 'pending')
      .eq('documents.status', 'in_progress')

    if (stepsError) {
      console.error('[send-reminders] query', stepsError.message)
      return json({ error: stepsError.message }, 500)
    }

    const now = new Date()
    const startOfTodayUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    )

    let sent = 0
    let skipped = 0

    for (const step of pendingSteps ?? []) {
      const document = Array.isArray(step.documents) ? step.documents[0] : step.documents
      if (!document) {
        skipped += 1
        continue
      }

      // Prefer current_step when set; otherwise treat pending as the active step.
      if (
        document.current_step != null &&
        Number(document.current_step) !== Number(step.step_order)
      ) {
        skipped += 1
        continue
      }

      if (step.last_reminder_sent_at) {
        const last = new Date(step.last_reminder_sent_at)
        if (last >= startOfTodayUtc) {
          skipped += 1
          continue
        }
      }

      const notes = parseNotes(step.notes)
      const deadlineHours = notes.deadlineHours ?? DEFAULT_DEADLINE_HOURS
      // Clock starts when the step became pending (updated_at is set on activation).
      const clockStart = new Date(step.updated_at ?? step.created_at)
      const deadlineAt = new Date(clockStart.getTime() + deadlineHours * 60 * 60 * 1000)
      if (now < deadlineAt) {
        skipped += 1
        continue
      }

      const [{ data: approver }, { data: initiator }, { data: org }] = await Promise.all([
        supabase
          .from('users')
          .select('id, full_name, email')
          .eq('id', step.assignee_user_id)
          .maybeSingle(),
        supabase
          .from('users')
          .select('full_name')
          .eq('id', document.initiated_by)
          .maybeSingle(),
        supabase
          .from('organisations')
          .select('name')
          .eq('id', document.organisation_id)
          .maybeSingle(),
      ])

      if (!approver?.email) {
        skipped += 1
        continue
      }

      const appUrl = (Deno.env.get('APP_URL') ?? Deno.env.get('NEXT_PUBLIC_APP_URL') ?? '').replace(
        /\/$/,
        ''
      )
      const documentUrl = `${appUrl || 'https://app.signara.com'}/dashboard/documents/${document.id}`
      const email = buildApprovalNeededEmail({
        approverName: approver.full_name,
        documentTitle: document.title,
        initiatorName: initiator?.full_name ?? 'A colleague',
        orgName: org?.name ?? 'your organisation',
        documentUrl,
        authorityText: notes.authorityText ?? '',
        isReminder: true,
      })

      await sendResendEmail({ to: approver.email, subject: email.subject, html: email.html })

      await supabase.from('notifications').insert({
        user_id: approver.id,
        document_id: document.id,
        type: 'approval_required',
        title: 'Reminder: approval required',
        message: `"${document.title}" is still waiting for your approval.`,
      })

      await supabase
        .from('document_steps')
        .update({ last_reminder_sent_at: now.toISOString() })
        .eq('id', step.id)

      sent += 1
    }

    return json({ ok: true, sent, skipped })
  } catch (err) {
    console.error('[send-reminders]', err)
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})

function parseNotes(notes: string | null): StepNotes {
  if (!notes) return {}
  try {
    return JSON.parse(notes) as StepNotes
  } catch {
    return {}
  }
}

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

function buildApprovalNeededEmail(input: {
  approverName: string
  documentTitle: string
  initiatorName: string
  orgName: string
  documentUrl: string
  authorityText: string
  isReminder?: boolean
}): { subject: string; html: string } {
  const subjectBase = `Action needed: ${input.documentTitle}`
  const subject = input.isReminder ? `Reminder: ${subjectBase}` : subjectBase
  const roleLine = input.authorityText
    ? ` Your role: <strong>${escapeHtml(input.authorityText)}</strong>.`
    : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background-color:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8F9FA;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;border:1px solid #e0e0e0;max-width:560px;width:100%;">
        <tr><td style="background:#0F2C59;padding:28px 40px;">
          <p style="margin:0;font-size:24px;font-weight:700;color:#fff;">Signa<span style="color:#D4AF37;">ra</span></p>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F2C59;">Reminder: approval needed</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4A5568;">
            Hi ${escapeHtml(input.approverName)}, ${escapeHtml(input.initiatorName)} has submitted a
            <strong>${escapeHtml(input.documentTitle)}</strong> that needs your approval.${roleLine}
          </p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4A5568;">
            This request is for <strong>${escapeHtml(input.orgName)}</strong> on Signara.
          </p>
          <a href="${escapeHtml(input.documentUrl)}" style="display:inline-block;padding:13px 32px;font-size:15px;font-weight:600;color:#0F2C59;text-decoration:none;border-radius:6px;background:#D4AF37;">
            Review and sign
          </a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { subject, html }
}

async function sendResendEmail(input: { to: string; subject: string; html: string }) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    console.warn('[send-reminders] RESEND_API_KEY missing; skipping email')
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
      console.error('[send-reminders] Resend error', await res.text())
    }
  } catch (err) {
    console.error('[send-reminders] email failed', err)
  }
}
