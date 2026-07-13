-- Soft-archive (`documents.archived`) is a list-visibility flag only.
-- Earlier completion flows set archived=true immediately on complete, which
-- conflicted with retention-policy archiving. Reset so completed docs remain
-- visible until policy/manual archive. The Archive page filters by status.
UPDATE documents
SET archived = false
WHERE archived = true;
