-- Additional departments a director/manager can approve for (beyond their primary department).
-- Managing Directors oversee all departments implicitly in application logic.

CREATE TABLE user_overseen_departments (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, department_id)
);

CREATE INDEX user_overseen_departments_user_id_idx ON user_overseen_departments (user_id);
CREATE INDEX user_overseen_departments_organisation_id_idx ON user_overseen_departments (organisation_id);

ALTER TABLE user_overseen_departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can read overseen departments" ON user_overseen_departments;
CREATE POLICY "Org members can read overseen departments"
ON user_overseen_departments FOR SELECT TO authenticated
USING (
  organisation_id = (
    SELECT organisation_id FROM users WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Org admins can manage overseen departments" ON user_overseen_departments;
CREATE POLICY "Org admins can manage overseen departments"
ON user_overseen_departments FOR ALL TO authenticated
USING (
  organisation_id = (
    SELECT organisation_id FROM users WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  organisation_id = (
    SELECT organisation_id FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);
