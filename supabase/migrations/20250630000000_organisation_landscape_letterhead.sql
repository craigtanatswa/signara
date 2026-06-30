-- Optional landscape letterhead for landscape templates
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS letterhead_landscape_url text;
