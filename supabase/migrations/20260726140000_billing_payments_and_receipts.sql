-- Payment attempts (EcoCash express + card) and receipt email history.

CREATE TABLE IF NOT EXISTS billing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES plans(id),
  method text NOT NULL CHECK (method IN ('ecocash', 'card')),
  reference text NOT NULL UNIQUE,
  poll_url text,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  receipt_email text NOT NULL,
  phone text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  paynow_reference text,
  error_message text,
  receipt_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_payments_org_created_idx
  ON billing_payments (organisation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS billing_payments_user_created_idx
  ON billing_payments (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS billing_receipt_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email)
);

CREATE INDEX IF NOT EXISTS billing_receipt_emails_user_last_used_idx
  ON billing_receipt_emails (user_id, last_used_at DESC);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS billing_receipt_email text;

-- RLS: users manage their own receipt emails; admins see org payments via service role primarily.
ALTER TABLE billing_receipt_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_receipt_emails_select_own
  ON billing_receipt_emails FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY billing_receipt_emails_insert_own
  ON billing_receipt_emails FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY billing_receipt_emails_update_own
  ON billing_receipt_emails FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY billing_payments_select_own
  ON billing_payments FOR SELECT
  USING (user_id = auth.uid());
