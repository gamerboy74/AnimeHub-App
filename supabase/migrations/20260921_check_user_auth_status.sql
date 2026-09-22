-- ============================================================
-- Migration: Check User Authentication Status Function
--
-- Why: Allows client applications to determine whether an account
-- exists and whether a password has been set (e.g. for Google OAuth users
-- who attempt email/password sign-in and need clear "Password not set" feedback).
-- Run in Supabase SQL Editor -> New Query -> Run
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_user_auth_status(lookup_email text)
RETURNS jsonb AS $$
DECLARE
  v_user record;
  v_has_password boolean := false;
  v_providers jsonb := '[]'::jsonb;
BEGIN
  -- Look up user in auth.users by lowercase email
  SELECT id, encrypted_password, raw_app_meta_data
  INTO v_user
  FROM auth.users
  WHERE lower(email) = lower(trim(lookup_email))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('exists', false);
  END IF;

  -- Determine if a valid password hash exists
  IF v_user.encrypted_password IS NOT NULL AND length(trim(v_user.encrypted_password)) > 0 THEN
    v_has_password := true;
  END IF;

  -- Extract providers list from raw_app_meta_data
  IF v_user.raw_app_meta_data IS NOT NULL AND v_user.raw_app_meta_data ? 'providers' THEN
    v_providers := v_user.raw_app_meta_data->'providers';
  END IF;

  RETURN jsonb_build_object(
    'exists', true,
    'has_password', v_has_password,
    'providers', v_providers
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to anon and authenticated clients
GRANT EXECUTE ON FUNCTION public.check_user_auth_status(text) TO anon, authenticated;
