-- Fix infinite recursion between documents ↔ document_steps SELECT policies.
-- Cross-table checks must run in SECURITY DEFINER functions so they bypass RLS
-- and do not re-enter the other table's policy.

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

-- Bypasses RLS on document_steps (avoids documents → document_steps → documents loop).
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

-- Bypasses RLS on documents (avoids document_steps → documents → document_steps loop).
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

-- Drop every known recursive / predecessor SELECT policy name.
DROP POLICY IF EXISTS "Org members can read accessible documents" ON documents;
DROP POLICY IF EXISTS "Org members can read related documents" ON documents;
DROP POLICY IF EXISTS "Members read own initiated documents" ON documents;
DROP POLICY IF EXISTS "Members read documents they initiated or are assigned to" ON documents;

DROP POLICY IF EXISTS "Members read steps for accessible documents" ON document_steps;
DROP POLICY IF EXISTS "Users can read related document steps" ON document_steps;
DROP POLICY IF EXISTS "Members read assigned document steps" ON document_steps;

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_steps ENABLE ROW LEVEL SECURITY;

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
