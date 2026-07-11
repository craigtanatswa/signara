-- Billing fields, archive/PDF helpers, ZWG plan prices, and template department ACLs.
-- Note: departments table + RLS and document_steps.last_reminder_sent_at already exist.

-- ── Billing fields on organisations ──────────────────────────────────────────
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trialing'
    CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled')),
  ADD COLUMN IF NOT EXISTS archive_policy_months integer DEFAULT 12,
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'none'
    CHECK (payment_method IN ('none', 'paynow')),
  ADD COLUMN IF NOT EXISTS paynow_renewal_date timestamptz,
  ADD COLUMN IF NOT EXISTS paynow_reference text;

-- ── ZWG pricing on plans ──────────────────────────────────────────────────────
ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_zwg numeric;

UPDATE plans SET price_zwg = 0   WHERE id = 'trial';
UPDATE plans SET price_zwg = 29  WHERE id = 'starter';
UPDATE plans SET price_zwg = 79  WHERE id = 'growth';
UPDATE plans SET price_zwg = 199 WHERE id = 'enterprise';

-- ── Document count helper (for plan limit enforcement) ────────────────────────
CREATE OR REPLACE FUNCTION get_org_document_count_this_month(org_id uuid)
RETURNS integer AS $$
  SELECT count(*)::integer FROM documents
  WHERE organisation_id = org_id
  AND created_at >= date_trunc('month', now())
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Archived flag on documents ────────────────────────────────────────────────
ALTER TABLE documents ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;

-- ── Final PDF storage on documents ───────────────────────────────────────────
ALTER TABLE documents ADD COLUMN IF NOT EXISTS final_pdf_url text;

-- ── User active flag (needed for Part 4 deactivation) ────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- ── Template department permissions (needed for Part 4) ──────────────────────
ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS allowed_departments text[] DEFAULT NULL;
