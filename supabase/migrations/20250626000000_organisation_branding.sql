-- Organisation letterhead background URL (logo_url already exists on organisations)
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS letterhead_url text;

-- Public bucket for org logos and letterhead images (run once in Supabase dashboard or via CLI)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organisation-assets',
  'organisation-assets',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Admins upload/read assets for their organisation folder
CREATE POLICY "Org admins can upload branding assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'organisation-assets'
  AND (storage.foldername(name))[1] = (
    SELECT organisation_id::text FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Org admins can update branding assets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'organisation-assets'
  AND (storage.foldername(name))[1] = (
    SELECT organisation_id::text FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Org admins can delete branding assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'organisation-assets'
  AND (storage.foldername(name))[1] = (
    SELECT organisation_id::text FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Authenticated users can read org branding assets"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'organisation-assets');
