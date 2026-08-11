-- Email-verify signup / join links / forced onboarding support

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- Existing members (and seeded demos) should not be forced through the wizard
UPDATE users
SET onboarding_completed_at = COALESCE(onboarding_completed_at, created_at)
WHERE onboarding_completed_at IS NULL;

-- ─── Email-specific organisation invites ─────────────────────────────────────

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
  -- null = unlimited approvals
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

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE organisation_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_join_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_join_requests ENABLE ROW LEVEL SECURITY;

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
