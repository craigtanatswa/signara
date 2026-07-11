-- Separate archive filing department from template access scope.
-- Access remains scope + department_id; completed documents file under archive_department_id.

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS archive_department_id uuid REFERENCES departments(id) ON DELETE SET NULL;

-- Existing department-scoped templates already filed under department_id.
UPDATE templates
SET archive_department_id = department_id
WHERE archive_department_id IS NULL
  AND department_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS templates_archive_department_id_idx
  ON templates (archive_department_id);
