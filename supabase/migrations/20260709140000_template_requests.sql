-- Template requests: seniors/supervisors+ ask admins to digitise a physical form
-- for their department. Attachment is a PDF or image of the paper form.

CREATE TABLE IF NOT EXISTS template_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  title text NOT NULL,
  description text,
  attachment_path text NOT NULL,
  attachment_filename text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'fulfilled', 'dismissed')),
  admin_notes text,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  resulting_template_id uuid REFERENCES templates(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS template_requests_org_status_idx
  ON template_requests (organisation_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS template_requests_requested_by_idx
  ON template_requests (requested_by, created_at DESC);

ALTER TABLE template_requests ENABLE ROW LEVEL SECURITY;

-- Requesters can see their own requests; admins see all in their org.
DROP POLICY IF EXISTS "Org members can read own or admin all template requests" ON template_requests;
CREATE POLICY "Org members can read own or admin all template requests"
ON template_requests FOR SELECT TO authenticated
USING (
  organisation_id = (SELECT organisation_id FROM users WHERE id = auth.uid())
  AND (
    requested_by = auth.uid()
    OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  )
);

-- Eligible members insert for their own org (job-level gate enforced in app).
DROP POLICY IF EXISTS "Org members can insert template requests" ON template_requests;
CREATE POLICY "Org members can insert template requests"
ON template_requests FOR INSERT TO authenticated
WITH CHECK (
  organisation_id = (SELECT organisation_id FROM users WHERE id = auth.uid())
  AND requested_by = auth.uid()
);

-- Only admins update status / notes.
DROP POLICY IF EXISTS "Org admins can update template requests" ON template_requests;
CREATE POLICY "Org admins can update template requests"
ON template_requests FOR UPDATE TO authenticated
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

-- Private bucket for physical-form scans (PDF / images).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'template-request-attachments',
  'template-request-attachments',
  false,
  15728640,
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Org members can upload template request attachments" ON storage.objects;
CREATE POLICY "Org members can upload template request attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'template-request-attachments'
  AND (storage.foldername(name))[1] = (
    SELECT organisation_id::text FROM users WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Org members can read template request attachments" ON storage.objects;
CREATE POLICY "Org members can read template request attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'template-request-attachments'
  AND (storage.foldername(name))[1] = (
    SELECT organisation_id::text FROM users WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Org members can delete template request attachments" ON storage.objects;
CREATE POLICY "Org members can delete template request attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'template-request-attachments'
  AND (storage.foldername(name))[1] = (
    SELECT organisation_id::text FROM users WHERE id = auth.uid()
  )
);
