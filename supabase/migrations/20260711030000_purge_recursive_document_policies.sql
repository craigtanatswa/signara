-- Purge ALL policies on documents / document_steps (including any leftover
-- recursive SELECT policies from 20260710230000), then recreate safe ones.
-- Cross-table checks use SECURITY DEFINER helpers only — never query the
-- other table directly inside a policy expression.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'documents'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.documents', r.policyname);
  END LOOP;

  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'document_steps'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.document_steps', r.policyname);
  END LOOP;
END $$;

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

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_steps ENABLE ROW LEVEL SECURITY;

-- SELECT
CREATE POLICY "Org members can read accessible documents"
ON documents
FOR SELECT
TO authenticated
USING (
  organisation_id = public.current_user_organisation_id()
  AND (
    initiated_by = auth.uid()
    OR public.current_user_is_org_admin()
    OR public.user_is_document_assignee(id)
  )
);

CREATE POLICY "Members read steps for accessible documents"
ON document_steps
FOR SELECT
TO authenticated
USING (
  assignee_user_id = auth.uid()
  OR public.user_can_read_document_steps(document_id)
);

-- INSERT / UPDATE (member client used for initiation; approvals use service role)
CREATE POLICY "Org members can insert documents"
ON documents
FOR INSERT
TO authenticated
WITH CHECK (
  organisation_id = public.current_user_organisation_id()
  AND initiated_by = auth.uid()
);

CREATE POLICY "Initiators can update own documents"
ON documents
FOR UPDATE
TO authenticated
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

CREATE POLICY "Initiators can insert document steps"
ON document_steps
FOR INSERT
TO authenticated
WITH CHECK (public.user_is_document_initiator(document_id));

CREATE POLICY "Initiators can update document steps"
ON document_steps
FOR UPDATE
TO authenticated
USING (
  public.user_is_document_initiator(document_id)
  OR public.current_user_is_org_admin()
)
WITH CHECK (
  public.user_is_document_initiator(document_id)
  OR public.current_user_is_org_admin()
);
