/**
 * archive-documents — Supabase Edge Function
 *
 * Soft-archives completed/rejected documents that are older than each
 * organisation's `archive_policy_months` setting. Archiving is non-destructive:
 * it only sets `archived = true` so documents are hidden from default list
 * views. PDF download and detail access remain available.
 *
 * ## Scheduling
 *
 * Same pg_cron approach as send-reminders — run once daily.
 *
 * Example pg_cron + pg_net (run in SQL editor after enabling extensions):
 *
 *   select cron.schedule(
 *     'archive-documents-daily',
 *     '0 2 * * *',
 *     $$
 *     select net.http_post(
 *       url := 'https://<PROJECT_REF>.supabase.co/functions/v1/archive-documents',
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
 *   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const DEFAULT_POLICY_MONTHS = 12

interface OrgRow {
  id: string
  archive_policy_months: number | null
}

interface DocRow {
  id: string
  status: string
  completed_at: string | null
  created_at: string
  archived: boolean | null
}

function shouldArchive(
  document: Pick<DocRow, 'status' | 'completed_at' | 'created_at'>,
  policyMonths: number
): boolean {
  if (policyMonths <= 0) return false
  if (document.status !== 'completed' && document.status !== 'rejected') {
    return false
  }

  const anchor =
    document.status === 'completed' && document.completed_at
      ? document.completed_at
      : document.created_at

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - policyMonths)

  return new Date(anchor).getTime() < cutoff.getTime()
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
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

    const { data: orgs, error: orgsError } = await supabase
      .from('organisations')
      .select('id, archive_policy_months')

    if (orgsError) {
      return json({ error: orgsError.message }, 500)
    }

    let archivedTotal = 0
    const perOrg: Array<{ organisationId: string; archived: number; policyMonths: number }> = []

    for (const org of (orgs ?? []) as OrgRow[]) {
      const policyMonths =
        typeof org.archive_policy_months === 'number' && org.archive_policy_months > 0
          ? org.archive_policy_months
          : DEFAULT_POLICY_MONTHS

      // Fetch candidates that are not already archived
      const { data: docs, error: docsError } = await supabase
        .from('documents')
        .select('id, status, completed_at, created_at, archived')
        .eq('organisation_id', org.id)
        .in('status', ['completed', 'rejected'])
        .or('archived.eq.false,archived.is.null')

      if (docsError) {
        console.error('[archive-documents] docs', org.id, docsError.message)
        continue
      }

      const toArchive = ((docs ?? []) as DocRow[])
        .filter((doc) => shouldArchive(doc, policyMonths))
        .map((doc) => doc.id)

      if (toArchive.length === 0) {
        perOrg.push({ organisationId: org.id, archived: 0, policyMonths })
        continue
      }

      const now = new Date().toISOString()
      // Batch updates in chunks to avoid oversized payloads
      const chunkSize = 100
      let archived = 0
      for (let i = 0; i < toArchive.length; i += chunkSize) {
        const chunk = toArchive.slice(i, i + chunkSize)
        const { data, error } = await supabase
          .from('documents')
          .update({ archived: true, updated_at: now })
          .in('id', chunk)
          .select('id')

        if (error) {
          console.error('[archive-documents] update', org.id, error.message)
          continue
        }
        archived += data?.length ?? 0
      }

      archivedTotal += archived
      perOrg.push({ organisationId: org.id, archived, policyMonths })
    }

    return json({
      ok: true,
      archivedTotal,
      organisations: perOrg,
    })
  } catch (err) {
    console.error('[archive-documents]', err)
    return json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      500
    )
  }
})
