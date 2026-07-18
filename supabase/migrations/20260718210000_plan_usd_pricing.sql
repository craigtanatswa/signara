-- Align paid plan USD pricing with product tiers.
UPDATE plans SET price_usd = 50  WHERE id = 'starter';
UPDATE plans SET price_usd = 75  WHERE id = 'growth';
UPDATE plans SET price_usd = 100 WHERE id = 'enterprise';
