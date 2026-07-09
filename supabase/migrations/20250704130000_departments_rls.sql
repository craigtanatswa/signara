-- Row-level security for departments (org-scoped, admin-managed)

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can read departments" ON departments;
CREATE POLICY "Org members can read departments"
ON departments FOR SELECT TO authenticated
USING (
  organisation_id = (
    SELECT organisation_id FROM users WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Org admins can insert departments" ON departments;
CREATE POLICY "Org admins can insert departments"
ON departments FOR INSERT TO authenticated
WITH CHECK (
  organisation_id = (
    SELECT organisation_id FROM users WHERE id = auth.uid() AND role = 'admin'
  )
  AND is_executive = false
);

DROP POLICY IF EXISTS "Org admins can delete departments" ON departments;
CREATE POLICY "Org admins can delete departments"
ON departments FOR DELETE TO authenticated
USING (
  organisation_id = (
    SELECT organisation_id FROM users WHERE id = auth.uid() AND role = 'admin'
  )
  AND is_executive = false
);
