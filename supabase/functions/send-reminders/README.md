# send-reminders

Hourly job that emails approvers when a pending step has passed its `deadlineHours` and no reminder was sent yet today.

## Deploy

```bash
supabase functions deploy send-reminders
supabase secrets set RESEND_API_KEY=... RESEND_FROM_EMAIL="Signara <noreply@yourdomain.com>" APP_URL=https://your-app-url
```

## Schedule

Set up a Supabase Cron job (Database → Cron Jobs in the dashboard) to run this Edge Function every hour using pg_cron, or use an external scheduler like cron-job.org hitting the function's HTTP endpoint.

Example (pg_cron + pg_net):

```sql
select cron.schedule(
  'send-approval-reminders',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || '<SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```
