-- Private bucket for file-type form field uploads collected during document
-- initiation. Not public — access is via short-lived signed URLs generated
-- server-side for organisation members only.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('document-attachments', 'document-attachments', false, 15728640)
ON CONFLICT (id) DO NOTHING;

-- Any authenticated member of the organisation folder can upload attachments
-- for documents they're filling in.
CREATE POLICY "Org members can upload document attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'document-attachments'
  AND (storage.foldername(name))[1] = (
    SELECT organisation_id::text FROM users WHERE id = auth.uid()
  )
);

-- Any org member can view attachments within their organisation (approvers
-- need to see files attached by the initiator).
CREATE POLICY "Org members can read document attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'document-attachments'
  AND (storage.foldername(name))[1] = (
    SELECT organisation_id::text FROM users WHERE id = auth.uid()
  )
);

-- Uploader can remove/replace their own attachment while still drafting.
CREATE POLICY "Org members can delete their document attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'document-attachments'
  AND (storage.foldername(name))[1] = (
    SELECT organisation_id::text FROM users WHERE id = auth.uid()
  )
);
