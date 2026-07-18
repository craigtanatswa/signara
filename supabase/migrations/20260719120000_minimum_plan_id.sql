-- Minimum plan tier required before the organisation can use the app again
-- (set when an admin downgrades via Paynow, cleared on upgrade).

ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS minimum_plan_id text;
