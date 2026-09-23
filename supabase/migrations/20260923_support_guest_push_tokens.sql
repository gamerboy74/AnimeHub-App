-- ============================================================
-- Migration: Support Guest Devices in user_push_tokens
-- Allows push tokens to be stored for non-signed-in guests
-- so they can receive trending & free episode drop alerts.
-- ============================================================

-- 1. Make user_id nullable for guest devices
ALTER TABLE public.user_push_tokens ALTER COLUMN user_id DROP NOT NULL;

-- 2. Add guest tracking columns
ALTER TABLE public.user_push_tokens 
  ADD COLUMN IF NOT EXISTS is_guest boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS guest_device_id text;

-- 3. Unique index for guest tokens (prevents duplicates when user_id is null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_push_tokens_guest_token
  ON public.user_push_tokens (token)
  WHERE is_guest = true;

-- 4. Enable RLS policy for guest devices to register their push token
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_push_tokens' AND policyname = 'Guests can insert their push tokens'
  ) THEN
    CREATE POLICY "Guests can insert their push tokens"
      ON public.user_push_tokens
      FOR INSERT
      WITH CHECK (is_guest = true AND user_id IS NULL);
  END IF;
END $$;
