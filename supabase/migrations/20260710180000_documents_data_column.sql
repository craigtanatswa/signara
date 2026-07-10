-- Store filled form field values (keyed by template fieldId), including
-- initiator signature data URLs collected during document initiation.
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS data jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN documents.data IS
  'Form field values keyed by template fieldId (text, dates, files, initiator signature, etc.).';
