ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS brand_theme text NOT NULL DEFAULT 'navy'
  CHECK (brand_theme IN ('navy', 'green', 'black', 'maroon'));
