-- Align legacy document schema column names with what the application uses.
-- Original base schema (pre-app TypeScript types) used different names:
--   documents.field_values  → documents.data
--   document_steps.step_index → document_steps.step_order
--   document_steps.signature_data → document_steps.signature_url
--   document_steps.comment → document_steps.notes
--
-- Earlier migrations added some of the new names alongside the old ones.
-- This migration consolidates to the names the app reads/writes.

-- ─── documents.data ← field_values ──────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'field_values'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'data'
  ) THEN
    -- Prefer existing field_values content when data is empty.
    UPDATE documents
    SET data = field_values
    WHERE (data IS NULL OR data = '{}'::jsonb)
      AND field_values IS NOT NULL;

    ALTER TABLE documents DROP COLUMN field_values;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'field_values'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'data'
  ) THEN
    ALTER TABLE documents RENAME COLUMN field_values TO data;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'data'
  ) THEN
    ALTER TABLE documents ADD COLUMN data jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS current_step integer;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- ─── document_steps.step_order ← step_index ─────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_steps' AND column_name = 'step_index'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_steps' AND column_name = 'step_order'
  ) THEN
    ALTER TABLE document_steps RENAME COLUMN step_index TO step_order;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_steps' AND column_name = 'step_index'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_steps' AND column_name = 'step_order'
  ) THEN
    UPDATE document_steps
    SET step_order = step_index
    WHERE step_order IS NULL;
    ALTER TABLE document_steps DROP COLUMN step_index;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_steps' AND column_name = 'step_order'
  ) THEN
    ALTER TABLE document_steps ADD COLUMN step_order integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ─── document_steps.signature_url ← signature_data ──────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_steps' AND column_name = 'signature_data'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_steps' AND column_name = 'signature_url'
  ) THEN
    ALTER TABLE document_steps RENAME COLUMN signature_data TO signature_url;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_steps' AND column_name = 'signature_data'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_steps' AND column_name = 'signature_url'
  ) THEN
    UPDATE document_steps
    SET signature_url = signature_data
    WHERE signature_url IS NULL AND signature_data IS NOT NULL;
    ALTER TABLE document_steps DROP COLUMN signature_data;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_steps' AND column_name = 'signature_url'
  ) THEN
    ALTER TABLE document_steps ADD COLUMN signature_url text;
  END IF;
END $$;

-- ─── document_steps.notes ← comment ─────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_steps' AND column_name = 'comment'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_steps' AND column_name = 'notes'
  ) THEN
    ALTER TABLE document_steps RENAME COLUMN comment TO notes;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_steps' AND column_name = 'comment'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_steps' AND column_name = 'notes'
  ) THEN
    UPDATE document_steps
    SET notes = comment
    WHERE (notes IS NULL OR notes = '') AND comment IS NOT NULL;
    ALTER TABLE document_steps DROP COLUMN comment;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_steps' AND column_name = 'notes'
  ) THEN
    ALTER TABLE document_steps ADD COLUMN notes text;
  END IF;
END $$;

-- ─── Remaining columns the app writes ───────────────────────────────────────

ALTER TABLE document_steps
  ADD COLUMN IF NOT EXISTS assignee_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE document_steps
  ADD COLUMN IF NOT EXISTS signed_at timestamptz;

ALTER TABLE document_steps
  ADD COLUMN IF NOT EXISTS signature_field_id text;

ALTER TABLE document_steps
  ADD COLUMN IF NOT EXISTS workflow_step_id text;

ALTER TABLE document_steps
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Ensure step_order is usable for ordering / inserts
ALTER TABLE document_steps
  ALTER COLUMN step_order SET DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'document_steps'
      AND column_name = 'step_order'
      AND is_nullable = 'YES'
  ) THEN
    UPDATE document_steps SET step_order = 0 WHERE step_order IS NULL;
    ALTER TABLE document_steps ALTER COLUMN step_order SET NOT NULL;
  END IF;
END $$;

-- Status constraints used by the hybrid sequential workflow
ALTER TABLE document_steps
  DROP CONSTRAINT IF EXISTS document_steps_status_check;

ALTER TABLE document_steps
  ADD CONSTRAINT document_steps_status_check
  CHECK (status IN ('waiting', 'pending', 'approved', 'rejected', 'skipped'));

ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_status_check;

ALTER TABLE documents
  ADD CONSTRAINT documents_status_check
  CHECK (status IN ('draft', 'in_progress', 'completed', 'rejected', 'cancelled'));
