-- =============================================================================
-- Signara — fresh Supabase project bootstrap
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
-- Then: node scripts/seed-demo-users.mjs
-- =============================================================================

-- ─── Plans ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  max_users integer,
  max_documents_per_month integer,
  price_usd numeric,
  price_zwg numeric,
  features jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO plans (id, name, max_users, max_documents_per_month, price_usd, price_zwg, features)
VALUES
  (
    'trial',
    'Free Trial',
    5,
    25,
    0,
    0,
    '["Up to 5 users","25 documents / month","Digital & physical signing","Email support"]'::jsonb
  ),
  (
    'starter',
    'Starter',
    10,
    100,
    50,
    29,
    '["Up to plan user limit","Monthly document allowance","Digital & physical signing","Email support"]'::jsonb
  ),
  (
    'growth',
    'Growth',
    25,
    500,
    75,
    79,
    '["Higher user & document limits","Approval workflows & routing","Organisation branding","Priority email support"]'::jsonb
  ),
  (
    'enterprise',
    'Enterprise',
    NULL,
    NULL,
    100,
    199,
    '["Unlimited users & documents","Advanced workflows","Custom branding","Dedicated support"]'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  max_users = EXCLUDED.max_users,
  max_documents_per_month = EXCLUDED.max_documents_per_month,
  price_usd = EXCLUDED.price_usd,
  price_zwg = EXCLUDED.price_zwg,
  features = EXCLUDED.features;

-- ─── Organisations ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  letterhead_url text,
  letterhead_landscape_url text,
  brand_theme text NOT NULL DEFAULT 'navy'
    CHECK (brand_theme IN ('navy', 'green', 'black', 'maroon')),
  plan_id text NOT NULL DEFAULT 'trial' REFERENCES plans(id),
  trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),
  subscription_status text DEFAULT 'trialing'
    CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled')),
  archive_policy_months integer DEFAULT 12,
  payment_method text DEFAULT 'none'
    CHECK (payment_method IN ('none', 'paynow')),
  paynow_renewal_date timestamptz,
  paynow_reference text,
  minimum_plan_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Users (profile rows; id must match auth.users.id) ───────────────────────

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  position text,
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'member')),
  avatar_url text,
  department text,
  department_id uuid,
  job_level text NOT NULL DEFAULT 'staff'
    CHECK (job_level IN (
      'managing_director',
      'director',
      'manager',
      'supervisor',
      'senior',
      'staff'
    )),
  must_change_password boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  onboarding_checklist_dismissed_at timestamptz,
  onboarding_completed_at timestamptz,
  billing_receipt_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_one_md_per_org
  ON users (organisation_id)
  WHERE job_level = 'managing_director';

CREATE INDEX IF NOT EXISTS users_organisation_id_idx ON users (organisation_id);
CREATE INDEX IF NOT EXISTS users_department_id_idx ON users (department_id);

-- ─── Departments ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  is_executive boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, slug),
  UNIQUE (organisation_id, name)
);

CREATE INDEX IF NOT EXISTS departments_organisation_id_idx ON departments (organisation_id);

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_department_id_fkey;

ALTER TABLE users
  ADD CONSTRAINT users_department_id_fkey
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;

-- ─── Overseen departments ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_overseen_departments (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, department_id)
);

CREATE INDEX IF NOT EXISTS user_overseen_departments_user_id_idx
  ON user_overseen_departments (user_id);
CREATE INDEX IF NOT EXISTS user_overseen_departments_organisation_id_idx
  ON user_overseen_departments (organisation_id);

-- ─── Templates ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  content jsonb,
  workflow jsonb NOT NULL DEFAULT '{"steps":[]}'::jsonb,
  scope text NOT NULL DEFAULT 'organisation'
    CHECK (scope IN ('organisation', 'department')),
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  allowed_departments text[] DEFAULT NULL,
  archive_department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  template_type text,
  source_file_url text,
  field_positions jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT templates_department_scope_check CHECK (
    (scope = 'organisation' AND department_id IS NULL)
    OR (scope = 'department' AND department_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS templates_organisation_id_idx ON templates (organisation_id);
CREATE INDEX IF NOT EXISTS templates_department_id_idx ON templates (department_id);
CREATE INDEX IF NOT EXISTS templates_archive_department_id_idx ON templates (archive_department_id);

-- ─── Documents ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  template_id uuid REFERENCES templates(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_progress', 'completed', 'rejected', 'cancelled')),
  initiated_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  data jsonb DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  current_step integer,
  rejection_reason text,
  archived boolean DEFAULT false,
  final_pdf_url text,
  physical_signature_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_organisation_id_idx ON documents (organisation_id);
CREATE INDEX IF NOT EXISTS documents_initiated_by_idx ON documents (initiated_by);
CREATE INDEX IF NOT EXISTS documents_template_id_idx ON documents (template_id);

-- ─── Document steps ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  step_order integer NOT NULL DEFAULT 0,
  assignee_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'pending', 'approved', 'rejected', 'skipped')),
  signed_at timestamptz,
  signature_url text,
  signature_field_id text,
  workflow_step_id text,
  notes text,
  last_reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_steps_document_id_idx ON document_steps (document_id);
CREATE INDEX IF NOT EXISTS document_steps_assignee_user_id_idx ON document_steps (assignee_user_id);

-- ─── Notifications ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  type text NOT NULL,
  title text,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx
  ON notifications (user_id, created_at DESC);

-- ─── User signatures ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'My signature',
  method text NOT NULL CHECK (method IN ('draw', 'type', 'upload')),
  image_data text NOT NULL CHECK (image_data LIKE 'data:image/%'),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_signatures_user_id_idx
  ON user_signatures (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS user_signatures_one_default_per_user_idx
  ON user_signatures (user_id)
  WHERE is_default = true;

-- ─── Template requests ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS template_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  title text NOT NULL,
  description text,
  attachment_path text NOT NULL,
  attachment_filename text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'fulfilled', 'dismissed')),
  admin_notes text,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  resulting_template_id uuid REFERENCES templates(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS template_requests_org_status_idx
  ON template_requests (organisation_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS template_requests_requested_by_idx
  ON template_requests (requested_by, created_at DESC);

-- ─── Billing ─────────────────────────────────────────────────────────────────

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

-- ─── Organisation invites (email-specific) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS organisation_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  position text,
  role text NOT NULL CHECK (role IN ('admin', 'member')),
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  job_level text NOT NULL DEFAULT 'staff'
    CHECK (job_level IN (
      'managing_director',
      'director',
      'manager',
      'supervisor',
      'senior',
      'staff'
    )),
  overseen_department_ids uuid[] NOT NULL DEFAULT '{}',
  token text NOT NULL UNIQUE,
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organisation_invites_org_idx
  ON organisation_invites (organisation_id);

CREATE INDEX IF NOT EXISTS organisation_invites_email_idx
  ON organisation_invites (organisation_id, lower(email));

-- ─── Shareable join links ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organisation_join_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  default_role text NOT NULL DEFAULT 'member'
    CHECK (default_role IN ('admin', 'member')),
  max_uses integer CHECK (max_uses IS NULL OR max_uses > 0),
  approved_count integer NOT NULL DEFAULT 0 CHECK (approved_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS organisation_join_links_one_active_per_org
  ON organisation_join_links (organisation_id)
  WHERE is_active = true AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS organisation_join_links_org_idx
  ON organisation_join_links (organisation_id);

-- ─── Join requests from shareable links ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS organisation_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  join_link_id uuid NOT NULL REFERENCES organisation_join_links(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS organisation_join_requests_one_pending_email
  ON organisation_join_requests (organisation_id, lower(email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS organisation_join_requests_org_status_idx
  ON organisation_join_requests (organisation_id, status);

-- ─── Helper RPCs ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_org_document_count_this_month(org_id uuid)
RETURNS integer AS $$
  SELECT count(*)::integer FROM documents
  WHERE organisation_id = org_id
  AND created_at >= date_trunc('month', now())
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.current_user_organisation_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organisation_id FROM users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_org_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.user_is_document_assignee(p_document_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM document_steps
    WHERE document_id = p_document_id
      AND assignee_user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.user_can_read_document_steps(p_document_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM documents d
    WHERE d.id = p_document_id
      AND d.organisation_id = public.current_user_organisation_id()
      AND (
        d.initiated_by = auth.uid()
        OR public.current_user_is_org_admin()
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.user_is_document_initiator(p_document_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM documents d
    WHERE d.id = p_document_id
      AND d.organisation_id = public.current_user_organisation_id()
      AND d.initiated_by = auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION public.user_is_document_assignee(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_is_document_assignee(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.user_can_read_document_steps(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_read_document_steps(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.user_is_document_initiator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_is_document_initiator(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_org_document_count_this_month(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_document_count_this_month(uuid) TO service_role;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_overseen_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_receipt_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_join_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_join_requests ENABLE ROW LEVEL SECURITY;

-- Plans: readable by authenticated users (billing UI)
DROP POLICY IF EXISTS "Authenticated can read plans" ON plans;
CREATE POLICY "Authenticated can read plans"
ON plans FOR SELECT TO authenticated
USING (true);

-- Organisations
DROP POLICY IF EXISTS "Members can read own organisation" ON organisations;
CREATE POLICY "Members can read own organisation"
ON organisations FOR SELECT TO authenticated
USING (id = public.current_user_organisation_id());

DROP POLICY IF EXISTS "Admins can update own organisation" ON organisations;
CREATE POLICY "Admins can update own organisation"
ON organisations FOR UPDATE TO authenticated
USING (id = public.current_user_organisation_id() AND public.current_user_is_org_admin())
WITH CHECK (id = public.current_user_organisation_id() AND public.current_user_is_org_admin());

-- Users: members see self; admins see whole org
DROP POLICY IF EXISTS "Users can read self" ON users;
CREATE POLICY "Users can read self"
ON users FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR (
    organisation_id = public.current_user_organisation_id()
    AND public.current_user_is_org_admin()
  )
);

DROP POLICY IF EXISTS "Users can update self" ON users;
CREATE POLICY "Users can update self"
ON users FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Admins can update org users" ON users;
CREATE POLICY "Admins can update org users"
ON users FOR UPDATE TO authenticated
USING (
  organisation_id = public.current_user_organisation_id()
  AND public.current_user_is_org_admin()
)
WITH CHECK (
  organisation_id = public.current_user_organisation_id()
  AND public.current_user_is_org_admin()
);

-- Departments
DROP POLICY IF EXISTS "Org members can read departments" ON departments;
CREATE POLICY "Org members can read departments"
ON departments FOR SELECT TO authenticated
USING (organisation_id = public.current_user_organisation_id());

DROP POLICY IF EXISTS "Org admins can insert departments" ON departments;
CREATE POLICY "Org admins can insert departments"
ON departments FOR INSERT TO authenticated
WITH CHECK (
  organisation_id = public.current_user_organisation_id()
  AND public.current_user_is_org_admin()
  AND is_executive = false
);

DROP POLICY IF EXISTS "Org admins can delete departments" ON departments;
CREATE POLICY "Org admins can delete departments"
ON departments FOR DELETE TO authenticated
USING (
  organisation_id = public.current_user_organisation_id()
  AND public.current_user_is_org_admin()
  AND is_executive = false
);

-- Overseen departments
DROP POLICY IF EXISTS "Org members can read overseen departments" ON user_overseen_departments;
CREATE POLICY "Org members can read overseen departments"
ON user_overseen_departments FOR SELECT TO authenticated
USING (organisation_id = public.current_user_organisation_id());

DROP POLICY IF EXISTS "Org admins can manage overseen departments" ON user_overseen_departments;
CREATE POLICY "Org admins can manage overseen departments"
ON user_overseen_departments FOR ALL TO authenticated
USING (
  organisation_id = public.current_user_organisation_id()
  AND public.current_user_is_org_admin()
)
WITH CHECK (
  organisation_id = public.current_user_organisation_id()
  AND public.current_user_is_org_admin()
);

-- Templates
DROP POLICY IF EXISTS "Org members can read templates" ON templates;
CREATE POLICY "Org members can read templates"
ON templates FOR SELECT TO authenticated
USING (organisation_id = public.current_user_organisation_id());

DROP POLICY IF EXISTS "Org admins can insert templates" ON templates;
CREATE POLICY "Org admins can insert templates"
ON templates FOR INSERT TO authenticated
WITH CHECK (
  organisation_id = public.current_user_organisation_id()
  AND public.current_user_is_org_admin()
);

DROP POLICY IF EXISTS "Org admins can update templates" ON templates;
CREATE POLICY "Org admins can update templates"
ON templates FOR UPDATE TO authenticated
USING (
  organisation_id = public.current_user_organisation_id()
  AND public.current_user_is_org_admin()
)
WITH CHECK (
  organisation_id = public.current_user_organisation_id()
  AND public.current_user_is_org_admin()
);

DROP POLICY IF EXISTS "Org admins can delete templates" ON templates;
CREATE POLICY "Org admins can delete templates"
ON templates FOR DELETE TO authenticated
USING (
  organisation_id = public.current_user_organisation_id()
  AND public.current_user_is_org_admin()
);

-- Documents
DROP POLICY IF EXISTS "Org members can read accessible documents" ON documents;
CREATE POLICY "Org members can read accessible documents"
ON documents FOR SELECT TO authenticated
USING (
  organisation_id = public.current_user_organisation_id()
  AND (
    initiated_by = auth.uid()
    OR public.current_user_is_org_admin()
    OR public.user_is_document_assignee(id)
  )
);

DROP POLICY IF EXISTS "Org members can insert documents" ON documents;
CREATE POLICY "Org members can insert documents"
ON documents FOR INSERT TO authenticated
WITH CHECK (
  organisation_id = public.current_user_organisation_id()
  AND initiated_by = auth.uid()
);

DROP POLICY IF EXISTS "Initiators can update own documents" ON documents;
CREATE POLICY "Initiators can update own documents"
ON documents FOR UPDATE TO authenticated
USING (
  organisation_id = public.current_user_organisation_id()
  AND (
    initiated_by = auth.uid()
    OR public.current_user_is_org_admin()
  )
)
WITH CHECK (
  organisation_id = public.current_user_organisation_id()
  AND (
    initiated_by = auth.uid()
    OR public.current_user_is_org_admin()
  )
);

-- Document steps
DROP POLICY IF EXISTS "Members read steps for accessible documents" ON document_steps;
CREATE POLICY "Members read steps for accessible documents"
ON document_steps FOR SELECT TO authenticated
USING (
  assignee_user_id = auth.uid()
  OR public.user_can_read_document_steps(document_id)
);

DROP POLICY IF EXISTS "Initiators can insert document steps" ON document_steps;
CREATE POLICY "Initiators can insert document steps"
ON document_steps FOR INSERT TO authenticated
WITH CHECK (public.user_is_document_initiator(document_id));

DROP POLICY IF EXISTS "Initiators can update document steps" ON document_steps;
CREATE POLICY "Initiators can update document steps"
ON document_steps FOR UPDATE TO authenticated
USING (
  public.user_is_document_initiator(document_id)
  OR public.current_user_is_org_admin()
)
WITH CHECK (
  public.user_is_document_initiator(document_id)
  OR public.current_user_is_org_admin()
);

-- Notifications
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications"
ON notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- User signatures
DROP POLICY IF EXISTS "Users can read own signatures" ON user_signatures;
CREATE POLICY "Users can read own signatures"
ON user_signatures FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own signatures" ON user_signatures;
CREATE POLICY "Users can insert own signatures"
ON user_signatures FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own signatures" ON user_signatures;
CREATE POLICY "Users can update own signatures"
ON user_signatures FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own signatures" ON user_signatures;
CREATE POLICY "Users can delete own signatures"
ON user_signatures FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Template requests
DROP POLICY IF EXISTS "Org members can read own or admin all template requests" ON template_requests;
CREATE POLICY "Org members can read own or admin all template requests"
ON template_requests FOR SELECT TO authenticated
USING (
  organisation_id = public.current_user_organisation_id()
  AND (
    requested_by = auth.uid()
    OR public.current_user_is_org_admin()
  )
);

DROP POLICY IF EXISTS "Org members can insert template requests" ON template_requests;
CREATE POLICY "Org members can insert template requests"
ON template_requests FOR INSERT TO authenticated
WITH CHECK (
  organisation_id = public.current_user_organisation_id()
  AND requested_by = auth.uid()
);

DROP POLICY IF EXISTS "Org admins can update template requests" ON template_requests;
CREATE POLICY "Org admins can update template requests"
ON template_requests FOR UPDATE TO authenticated
USING (
  organisation_id = public.current_user_organisation_id()
  AND public.current_user_is_org_admin()
)
WITH CHECK (
  organisation_id = public.current_user_organisation_id()
  AND public.current_user_is_org_admin()
);

-- Billing
DROP POLICY IF EXISTS billing_receipt_emails_select_own ON billing_receipt_emails;
CREATE POLICY billing_receipt_emails_select_own
  ON billing_receipt_emails FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS billing_receipt_emails_insert_own ON billing_receipt_emails;
CREATE POLICY billing_receipt_emails_insert_own
  ON billing_receipt_emails FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS billing_receipt_emails_update_own ON billing_receipt_emails;
CREATE POLICY billing_receipt_emails_update_own
  ON billing_receipt_emails FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS billing_payments_select_own ON billing_payments;
CREATE POLICY billing_payments_select_own
  ON billing_payments FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Org admins manage invites" ON organisation_invites;
CREATE POLICY "Org admins manage invites"
ON organisation_invites FOR ALL TO authenticated
USING (
  organisation_id = public.current_user_organisation_id()
  AND public.current_user_is_org_admin()
)
WITH CHECK (
  organisation_id = public.current_user_organisation_id()
  AND public.current_user_is_org_admin()
);

DROP POLICY IF EXISTS "Org admins manage join links" ON organisation_join_links;
CREATE POLICY "Org admins manage join links"
ON organisation_join_links FOR ALL TO authenticated
USING (
  organisation_id = public.current_user_organisation_id()
  AND public.current_user_is_org_admin()
)
WITH CHECK (
  organisation_id = public.current_user_organisation_id()
  AND public.current_user_is_org_admin()
);

DROP POLICY IF EXISTS "Org admins manage join requests" ON organisation_join_requests;
CREATE POLICY "Org admins manage join requests"
ON organisation_join_requests FOR ALL TO authenticated
USING (
  organisation_id = public.current_user_organisation_id()
  AND public.current_user_is_org_admin()
)
WITH CHECK (
  organisation_id = public.current_user_organisation_id()
  AND public.current_user_is_org_admin()
);

-- ─── Storage buckets ─────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organisation-assets',
  'organisation-assets',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('document-attachments', 'document-attachments', false, 15728640)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'template-request-attachments',
  'template-request-attachments',
  false,
  15728640,
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Org admins can upload branding assets" ON storage.objects;
CREATE POLICY "Org admins can upload branding assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'organisation-assets'
  AND (storage.foldername(name))[1] = (
    SELECT organisation_id::text FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Org admins can update branding assets" ON storage.objects;
CREATE POLICY "Org admins can update branding assets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'organisation-assets'
  AND (storage.foldername(name))[1] = (
    SELECT organisation_id::text FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Org admins can delete branding assets" ON storage.objects;
CREATE POLICY "Org admins can delete branding assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'organisation-assets'
  AND (storage.foldername(name))[1] = (
    SELECT organisation_id::text FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Authenticated users can read org branding assets" ON storage.objects;
CREATE POLICY "Authenticated users can read org branding assets"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'organisation-assets');

DROP POLICY IF EXISTS "Org members can upload document attachments" ON storage.objects;
CREATE POLICY "Org members can upload document attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'document-attachments'
  AND (storage.foldername(name))[1] = (
    SELECT organisation_id::text FROM users WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Org members can read document attachments" ON storage.objects;
CREATE POLICY "Org members can read document attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'document-attachments'
  AND (storage.foldername(name))[1] = (
    SELECT organisation_id::text FROM users WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Org members can delete their document attachments" ON storage.objects;
CREATE POLICY "Org members can delete their document attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'document-attachments'
  AND (storage.foldername(name))[1] = (
    SELECT organisation_id::text FROM users WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Org members can upload template request attachments" ON storage.objects;
CREATE POLICY "Org members can upload template request attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'template-request-attachments'
  AND (storage.foldername(name))[1] = (
    SELECT organisation_id::text FROM users WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Org members can read template request attachments" ON storage.objects;
CREATE POLICY "Org members can read template request attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'template-request-attachments'
  AND (storage.foldername(name))[1] = (
    SELECT organisation_id::text FROM users WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Org members can delete template request attachments" ON storage.objects;
CREATE POLICY "Org members can delete template request attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'template-request-attachments'
  AND (storage.foldername(name))[1] = (
    SELECT organisation_id::text FROM users WHERE id = auth.uid()
  )
);
