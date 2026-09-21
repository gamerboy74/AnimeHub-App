-- ============================================================
-- Migration: Add subscription metadata & expiration columns
-- Tracks exact subscription period (30 days / 365 days)
-- ============================================================

-- 1. Ensure user_preferences has subscription_meta jsonb
ALTER TABLE public.user_preferences 
  ADD COLUMN IF NOT EXISTS subscription_meta jsonb DEFAULT NULL;

-- 2. Add subscription expiration and start timestamps to users table
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz DEFAULT NULL;

-- 3. Index on subscription_expires_at for swift midnight expiry sweeps
CREATE INDEX IF NOT EXISTS idx_users_subscription_expires 
  ON public.users(subscription_expires_at);

-- 4. Update the protection trigger to also protect subscription_expires_at
CREATE OR REPLACE FUNCTION public.protect_user_subscription_type()
RETURNS TRIGGER AS $$
BEGIN
  -- Service role (Edge Functions, backend cron) has full authorization
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Normal client trying to elevate to 'premium' without paying
  IF NEW.subscription_type IS DISTINCT FROM OLD.subscription_type THEN
    IF NEW.subscription_type = 'premium' AND (OLD.subscription_type IS NULL OR OLD.subscription_type = 'free') THEN
      RAISE EXCEPTION 'Unauthorized: Subscription upgrade requires verified payment via Edge Function.';
    END IF;
  END IF;

  -- Normal client trying to extend subscription_expires_at
  IF NEW.subscription_expires_at IS DISTINCT FROM OLD.subscription_expires_at THEN
    IF NEW.subscription_expires_at > COALESCE(OLD.subscription_expires_at, now()) THEN
      RAISE EXCEPTION 'Unauthorized: Expiration extension requires verified payment via Edge Function.';
    END IF;
  END IF;

  -- Normal client trying to make themselves admin
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin OR NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Unauthorized: Role modifications are not permitted.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
