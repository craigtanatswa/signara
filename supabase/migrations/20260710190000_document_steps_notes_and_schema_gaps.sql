-- Align documents / document_steps with columns the application already expects.
-- Earlier feature work assumed these existed in the base schema; several were
-- never added by a migration (notes was the immediate failure on submit).

-- ─── documents ──────────────────────────────────────────────────────────────

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS data jsonb DEFAULT '{}'::jsonb;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

COMMENT ON COLUMN documents.data IS
  'Form field values keyed by template fieldId (text, dates, files, initiator signature, etc.).';

COMMENT ON COLUMN documents.completed_at IS
  'When the document finished the full approval chain (status = completed).';

-- ─── document_steps ─────────────────────────────────────────────────────────

ALTER TABLE document_steps
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE document_steps
  ADD COLUMN IF NOT EXISTS signature_field_id text;

ALTER TABLE document_steps
  ADD COLUMN IF NOT EXISTS workflow_step_id text;

ALTER TABLE document_steps
  ADD COLUMN IF NOT EXISTS signed_at timestamptz;

ALTER TABLE document_steps
  ADD COLUMN IF NOT EXISTS signature_url text;

COMMENT ON COLUMN document_steps.notes IS
  'JSON blob: resolved policy metadata at creation time, plus optional rejectionReason.';

COMMENT ON COLUMN document_steps.signature_field_id IS
  'Template signature field this approval step is linked to.';

COMMENT ON COLUMN document_steps.workflow_step_id IS
  'Template workflow step id this document step was resolved from.';

COMMENT ON COLUMN document_steps.signed_at IS
  'When the assignee approved and signed this step.';

COMMENT ON COLUMN document_steps.signature_url IS
  'Approver signature image (data URL or storage path) captured at approval.';

-- Ensure sequential workflow statuses are allowed (idempotent if already applied).
ALTER TABLE document_steps
  DROP CONSTRAINT IF EXISTS document_steps_status_check;

ALTER TABLE document_steps
  ADD CONSTRAINT document_steps_status_check
  CHECK (status IN ('waiting', 'pending', 'approved', 'rejected', 'skipped'));

-- Ensure document lifecycle statuses used by the app are allowed.
ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_status_check;

ALTER TABLE documents
  ADD CONSTRAINT documents_status_check
  CHECK (status IN ('draft', 'in_progress', 'completed', 'rejected', 'cancelled'));
