-- ============================================================
-- Migration: Add use_native_player column to user_preferences
-- Run this in your Supabase SQL Editor
-- ============================================================

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS use_native_player boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN user_preferences.use_native_player IS
  'When true (default), AnimeHub injects its own HUD controls (seek bar, play/pause, quality picker) over the embedded video player. When false, the embedded player''s own native controls are left untouched.';
