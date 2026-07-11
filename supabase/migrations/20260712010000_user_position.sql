-- Optional job title / position shown when mentioning a user (e.g. "John Doe - Human Resources Officer").
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS position text;
