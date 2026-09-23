-- ============================================================
-- Migration: Security Hardening & Robust Push Token Registration
-- 1. Attaches protect_user_subscription_type trigger to BEFORE INSERT OR UPDATE
-- 2. Creates atomic register_device_push_token RPC to cleanly handle guest & member tokens
-- 3. Adds UPDATE & SELECT policies for guest push tokens
-- ============================================================

-- ── 1. Secure Users table on both INSERT and UPDATE ──────────
CREATE OR REPLACE FUNCTION public.protect_user_subscription_type()
RETURNS TRIGGER AS $$
BEGIN
  -- Service role (Edge Functions, backend cron) and Postgres superuser have full authorization
  IF current_user IN ('postgres', 'supabase_admin') OR (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- On INSERT: standard clients CANNOT self-grant premium, billing, or admin privileges
    NEW.subscription_type := 'free';
    NEW.subscription_expires_at := NULL;
    NEW.billing_cycle := NULL;
    NEW.is_admin := false;
    NEW.role := 'user';
    RETURN NEW;
  END IF;

  -- On UPDATE:
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

  -- Block client arbitrarily changing billing_cycle
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

DROP TRIGGER IF EXISTS trg_protect_user_subscription ON public.users;
CREATE TRIGGER trg_protect_user_subscription
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_subscription_type();


-- ── 2. Guest Push Token RLS Policies ──────────────────────────
DO $$
BEGIN
  -- Update policy for guest tokens
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_push_tokens' AND policyname = 'Guests can update their push tokens'
  ) THEN
    CREATE POLICY "Guests can update their push tokens"
      ON public.user_push_tokens
      FOR UPDATE
      USING (is_guest = true AND user_id IS NULL)
      WITH CHECK (is_guest = true AND user_id IS NULL);
  END IF;

  -- Delete policy for guests (cleanup)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_push_tokens' AND policyname = 'Guests can delete their push tokens'
  ) THEN
    CREATE POLICY "Guests can delete their push tokens"
      ON public.user_push_tokens
      FOR DELETE
      USING (is_guest = true AND user_id IS NULL);
  END IF;
END $$;


-- ── 3. Atomic Push Token Registration RPC ──────────────────────
-- Safely synchronizes push token for both guest and authenticated users.
-- Automatically purges guest row when user signs in on the same device.
CREATE OR REPLACE FUNCTION public.register_device_push_token(
  p_token text,
  p_device_name text DEFAULT 'Unknown Device',
  p_is_guest boolean DEFAULT false,
  p_guest_device_id text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token cannot be empty');
  END IF;

  -- If user is authenticated
  IF v_user_id IS NOT NULL AND NOT p_is_guest THEN
    -- 1. Remove any prior guest registration for this physical token
    DELETE FROM public.user_push_tokens
    WHERE token = p_token AND (is_guest = true OR user_id IS NULL);

    -- 2. Upsert token for authenticated user
    INSERT INTO public.user_push_tokens (user_id, token, device_name, is_guest, guest_device_id, updated_at)
    VALUES (v_user_id, p_token, p_device_name, false, NULL, v_now)
    ON CONFLICT (user_id, token)
    DO UPDATE SET
      device_name = EXCLUDED.device_name,
      is_guest = false,
      guest_device_id = NULL,
      updated_at = v_now;

    RETURN jsonb_build_object('success', true, 'mode', 'member', 'user_id', v_user_id);
  ELSE
    -- Anonymous / Guest registration
    -- Delete any existing entry for this token if it was a guest
    DELETE FROM public.user_push_tokens
    WHERE token = p_token AND is_guest = true;

    INSERT INTO public.user_push_tokens (user_id, token, device_name, is_guest, guest_device_id, updated_at)
    VALUES (NULL, p_token, p_device_name, true, p_guest_device_id, v_now);

    RETURN jsonb_build_object('success', true, 'mode', 'guest');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.register_device_push_token(text, text, boolean, text) TO anon, authenticated;
