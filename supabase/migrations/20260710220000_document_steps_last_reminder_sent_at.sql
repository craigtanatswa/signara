-- Reminder tracking for pending approval steps.
-- Used by the send-reminders Edge Function to avoid sending more than one
-- reminder email per step per calendar day.

ALTER TABLE document_steps
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz;

COMMENT ON COLUMN document_steps.last_reminder_sent_at IS
  'Timestamp of the last deadline reminder email sent for this step.';
