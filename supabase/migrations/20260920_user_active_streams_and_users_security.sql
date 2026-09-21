-- ============================================================
-- Migration: Concurrent Device Limit & Users Table Security
-- Run in Supabase SQL Editor → New Query → Run
-- ============================================================

-- ── 1. Create table for concurrent device stream tracking ────
CREATE TABLE IF NOT EXISTS public.user_active_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  device_name text,
  episode_id uuid REFERENCES public.episodes(id) ON DELETE SET NULL,
  last_heartbeat timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_device UNIQUE(user_id, device_id)
);

-- Index for fast heartbeat checks (used every time someone plays a video)
CREATE INDEX IF NOT EXISTS idx_active_streams_lookup
  ON public.user_active_streams(user_id, last_heartbeat);

-- ── 2. Enable Row Level Security (RLS) on user_active_streams ─
ALTER TABLE public.user_active_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own active stream records"
  ON public.user_active_streams
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 3. Protect Users table from client-side privilege escalation ──
-- Ensures normal clients cannot self-grant 'premium' or 'admin' status.
-- Upgrades to 'premium' MUST go through the Razorpay Edge Function (service_role).
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

  -- Normal client trying to make themselves admin
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin OR NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Unauthorized: Role modifications are not permitted.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_user_subscription ON public.users;
CREATE TRIGGER trg_protect_user_subscription
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_subscription_type();

-- ── 4. Verify table and policy creation ──────────────────────
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_active_streams';
