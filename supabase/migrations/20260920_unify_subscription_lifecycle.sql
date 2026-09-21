-- ============================================================
-- Migration: Unify Subscription Lifecycle (Single Source of Truth)
--
-- Why: Eliminates the "split-brain" architecture where subscription data
-- was split between user_preferences.subscription_meta and users table.
-- Now `public.users` is the authoritative source of truth.
-- ============================================================

-- 1. Ensure all subscription columns exist directly on public.users
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS billing_cycle text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz DEFAULT NULL;

-- 2. Backfill users table from existing user_preferences.subscription_meta
UPDATE public.users u
SET
  billing_cycle = COALESCE(u.billing_cycle, (p.subscription_meta->>'billing_cycle')),
  cancel_at_period_end = COALESCE(u.cancel_at_period_end, (p.subscription_meta->>'cancel_at_period_end')::boolean, false),
  subscription_expires_at = COALESCE(u.subscription_expires_at, (p.subscription_meta->>'next_renewal')::timestamptz),
  subscription_started_at = COALESCE(u.subscription_started_at, (p.subscription_meta->>'subscribed_at')::timestamptz)
FROM public.user_preferences p
WHERE p.user_id = u.id AND p.subscription_meta IS NOT NULL;

-- 3. Set sane fallback for existing premium users who have no billing_cycle
UPDATE public.users
SET billing_cycle = 'admin_grant'
WHERE subscription_type = 'premium' AND billing_cycle IS NULL;

-- 4. Compound Index for fast subscription lookups & expiry sweeps
CREATE INDEX IF NOT EXISTS idx_users_subscription_lifecycle
  ON public.users(subscription_type, subscription_expires_at);

-- 5. Atomic SQL procedure to expire subscriptions (can be called by pg_cron or edge functions)
CREATE OR REPLACE FUNCTION public.expire_lapsed_subscriptions()
RETURNS integer AS $$
DECLARE
  v_count integer;
BEGIN
  WITH expired AS (
    UPDATE public.users
    SET 
      subscription_type = 'free',
      billing_cycle = NULL,
      subscription_expires_at = NULL,
      cancel_at_period_end = false
    WHERE subscription_type = 'premium'
      AND (billing_cycle IS DISTINCT FROM 'admin_grant')
      AND subscription_expires_at IS NOT NULL
      AND subscription_expires_at <= now()
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM expired;

  -- Also clear legacy subscription_meta in user_preferences for backward compatibility
  UPDATE public.user_preferences
  SET subscription_meta = NULL
  WHERE user_id IN (
    SELECT id FROM public.users WHERE subscription_type = 'free'
  ) AND subscription_meta IS NOT NULL;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Updated Security Trigger:
-- Clients CAN toggle their own cancel_at_period_end (cancel / reactivate auto-renewal)
-- Clients CANNOT upgrade subscription_type or extend subscription_expires_at without paying
CREATE OR REPLACE FUNCTION public.protect_user_subscription_type()
RETURNS TRIGGER AS $$
BEGIN
  -- Service role (Edge Functions, backend cron) has full authorization
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Block client elevating to 'premium'
  IF NEW.subscription_type IS DISTINCT FROM OLD.subscription_type THEN
    IF NEW.subscription_type = 'premium' AND (OLD.subscription_type IS NULL OR OLD.subscription_type = 'free') THEN
      RAISE EXCEPTION 'Unauthorized: Subscription upgrade requires verified payment via Edge Function.';
    END IF;
  END IF;

  -- Block client extending subscription_expires_at into the future
  IF NEW.subscription_expires_at IS DISTINCT FROM OLD.subscription_expires_at THEN
    IF NEW.subscription_expires_at > COALESCE(OLD.subscription_expires_at, now()) THEN
      RAISE EXCEPTION 'Unauthorized: Expiration extension requires verified payment via Edge Function.';
    END IF;
  END IF;

  -- Block client arbitrarily changing billing_cycle to yearly/admin_grant
  IF NEW.billing_cycle IS DISTINCT FROM OLD.billing_cycle THEN
    IF NEW.billing_cycle IS NOT NULL AND OLD.billing_cycle IS NULL THEN
      RAISE EXCEPTION 'Unauthorized: Billing cycle changes require verified payment via Edge Function.';
    END IF;
  END IF;

  -- Block client elevating to admin or modifying role
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin OR NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Unauthorized: Role modifications are not permitted.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
