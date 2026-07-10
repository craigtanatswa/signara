-- Per-user saved signatures for reuse across documents (draw / type / upload).

CREATE TABLE IF NOT EXISTS user_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'My signature',
  method text NOT NULL
    CHECK (method IN ('draw', 'type', 'upload')),
  image_data text NOT NULL
    CHECK (image_data LIKE 'data:image/%'),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_signatures_user_id_idx
  ON user_signatures (user_id, created_at DESC);

-- At most one default signature per user.
CREATE UNIQUE INDEX IF NOT EXISTS user_signatures_one_default_per_user_idx
  ON user_signatures (user_id)
  WHERE is_default = true;

ALTER TABLE user_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own signatures" ON user_signatures;
CREATE POLICY "Users can read own signatures"
ON user_signatures FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own signatures" ON user_signatures;
CREATE POLICY "Users can insert own signatures"
ON user_signatures FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own signatures" ON user_signatures;
CREATE POLICY "Users can update own signatures"
ON user_signatures FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own signatures" ON user_signatures;
CREATE POLICY "Users can delete own signatures"
ON user_signatures FOR DELETE TO authenticated
USING (user_id = auth.uid());
