-- Hybrid approval workflow: template scope (organisation/department),
-- sequential document step execution (waiting -> pending -> approved/rejected),
-- and linking of document steps back to their template workflow step + signature field.

-- ─── Templates: organisation-wide vs department-scoped ──────────────────────

ALTER TABLE templates
  ADD COLUMN scope text NOT NULL DEFAULT 'organisation'
    CHECK (scope IN ('organisation', 'department')),
  ADD COLUMN department_id uuid REFERENCES departments(id) ON DELETE SET NULL;

ALTER TABLE templates
  ADD CONSTRAINT templates_department_scope_check
  CHECK (
    (scope = 'organisation' AND department_id IS NULL)
    OR (scope = 'department' AND department_id IS NOT NULL)
  );

CREATE INDEX templates_department_id_idx ON templates (department_id);

-- ─── Document steps: sequential execution + provenance ──────────────────────

-- 'waiting' = not yet active in the chain (a prior step hasn't been approved yet).
-- Existing rows default to 'pending' since older documents didn't have a waiting state.
ALTER TABLE document_steps
  DROP CONSTRAINT IF EXISTS document_steps_status_check;

ALTER TABLE document_steps
  ADD CONSTRAINT document_steps_status_check
  CHECK (status IN ('waiting', 'pending', 'approved', 'rejected', 'skipped'));

ALTER TABLE document_steps
  ADD COLUMN signature_field_id text,
  ADD COLUMN workflow_step_id text;
