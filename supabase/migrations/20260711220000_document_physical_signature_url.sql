-- Optional path to the physically signed scan stored on the document row
-- for department archive downloads (also kept on the final document_step).
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS physical_signature_url text;

COMMENT ON COLUMN documents.physical_signature_url IS
  'Storage path of the physically signed upload in document-attachments, when completed via print-and-sign.';
