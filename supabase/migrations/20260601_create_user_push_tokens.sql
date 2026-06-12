-- ============================================================
-- Migration: Create user_push_tokens table
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       text        NOT NULL,
  device_name text        NOT NULL DEFAULT 'Unknown Device',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- Each user can only have one entry per token (supports multiple devices per user)
  CONSTRAINT user_push_tokens_user_token_unique UNIQUE (user_id, token)
);

-- Index for fast lookups by user (e.g. when sending notifications to all user's devices)
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id
  ON public.user_push_tokens (user_id);

-- Index for fast token lookups (e.g. cleanup of stale tokens)
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_token
  ON public.user_push_tokens (token);

-- RLS: Users can only read/write their own tokens
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push tokens"
  ON public.user_push_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.user_push_tokens IS
  'Stores Expo push notification tokens for registered user devices. One row per user+token pair, supporting multiple devices per user.';
