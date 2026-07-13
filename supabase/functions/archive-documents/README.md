# archive-documents

Daily job that soft-archives completed/rejected documents older than each organisation's `archive_policy_months` (default 12).

Archiving sets `archived = true` only — it never deletes data or blocks PDF downloads. Archived documents are hidden from default document list views unless "Show archived documents" is enabled.

## Deploy

```bash
supabase functions deploy archive-documents
```

Required secrets (usually already set for other functions):

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
```

## Schedule

Same pg_cron approach as `send-reminders` — run once daily (example: 02:00 UTC).

```sql
select cron.schedule(
  'archive-documents-daily',
  '0 2 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/archive-documents',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || '<SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```
