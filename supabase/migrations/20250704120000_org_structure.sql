-- Departments and job levels for approval routing

CREATE TABLE departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  is_executive boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, slug),
  UNIQUE (organisation_id, name)
);

CREATE INDEX departments_organisation_id_idx ON departments (organisation_id);

ALTER TABLE users
  ADD COLUMN department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  ADD COLUMN job_level text NOT NULL DEFAULT 'staff'
    CHECK (job_level IN (
      'managing_director',
      'director',
      'manager',
      'supervisor',
      'senior',
      'staff'
    ));

CREATE UNIQUE INDEX users_one_md_per_org
  ON users (organisation_id)
  WHERE job_level = 'managing_director';

CREATE INDEX users_department_id_idx ON users (department_id);

-- Seed Executive department for every existing organisation
INSERT INTO departments (organisation_id, name, slug, is_executive)
SELECT id, 'Executive', 'executive', true
FROM organisations;

-- Link users whose free-text department matches "Executive" (case-insensitive)
UPDATE users u
SET department_id = d.id
FROM departments d
WHERE d.organisation_id = u.organisation_id
  AND d.is_executive = true
  AND u.department IS NOT NULL
  AND lower(trim(u.department)) IN ('executive', 'ceo', 'managing director', 'md');

-- Create departments from distinct legacy department names (non-executive)
INSERT INTO departments (organisation_id, name, slug, is_executive)
SELECT DISTINCT
  u.organisation_id,
  trim(u.department),
  lower(regexp_replace(trim(u.department), '[^a-zA-Z0-9]+', '-', 'g')),
  false
FROM users u
WHERE u.department IS NOT NULL
  AND trim(u.department) <> ''
  AND lower(trim(u.department)) NOT IN ('executive', 'ceo', 'managing director', 'md')
ON CONFLICT (organisation_id, slug) DO NOTHING;

-- Link remaining users to matching departments by name
UPDATE users u
SET department_id = d.id
FROM departments d
WHERE d.organisation_id = u.organisation_id
  AND u.department_id IS NULL
  AND u.department IS NOT NULL
  AND lower(trim(d.name)) = lower(trim(u.department));

-- Sole org member becomes Managing Director in Executive
UPDATE users u
SET
  job_level = 'managing_director',
  department_id = d.id
FROM departments d
WHERE d.organisation_id = u.organisation_id
  AND d.is_executive = true
  AND (
    SELECT count(*)::int FROM users u2 WHERE u2.organisation_id = u.organisation_id
  ) = 1;
