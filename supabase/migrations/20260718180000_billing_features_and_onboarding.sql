-- Plan feature bullets for billing UI + onboarding checklist dismiss preference.
-- Remote DB already has plans.features as jsonb (not text[]).

ALTER TABLE plans ADD COLUMN IF NOT EXISTS features jsonb;

UPDATE plans SET features = '[
  "Up to plan user limit",
  "Monthly document allowance",
  "Digital & physical signing",
  "Email support"
]'::jsonb WHERE id = 'starter';

UPDATE plans SET features = '[
  "Higher user & document limits",
  "Approval workflows & routing",
  "Organisation branding",
  "Priority email support"
]'::jsonb WHERE id = 'growth';

UPDATE plans SET features = '[
  "Unlimited users & documents",
  "Advanced workflows",
  "Custom branding",
  "Dedicated support"
]'::jsonb WHERE id = 'enterprise';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_checklist_dismissed_at timestamptz;
