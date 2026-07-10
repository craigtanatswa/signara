-- Allow assignees (and org admins) to read documents they did not initiate.
-- Cross-table checks use SECURITY DEFINER helpers so documents ↔ document_steps
-- policies do not recurse into each other.

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

REVOKE ALL ON FUNCTION public.user_is_document_assignee(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_is_document_assignee(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.user_can_read_document_steps(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_read_document_steps(uuid) TO authenticated;

-- ─── documents SELECT ───────────────────────────────────────────────────────

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read own initiated documents" ON documents;
DROP POLICY IF EXISTS "Members read documents they initiated or are assigned to" ON documents;
DROP POLICY IF EXISTS "Org members can read accessible documents" ON documents;

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

-- ─── document_steps SELECT ──────────────────────────────────────────────────

ALTER TABLE document_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read assigned document steps" ON document_steps;
DROP POLICY IF EXISTS "Members read steps for accessible documents" ON document_steps;

CREATE POLICY "Members read steps for accessible documents"
ON document_steps
FOR SELECT
TO authenticated
USING (
  assignee_user_id = auth.uid()
  OR public.user_can_read_document_steps(document_id)
);
