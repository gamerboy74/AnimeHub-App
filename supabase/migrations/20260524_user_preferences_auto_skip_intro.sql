-- ============================================================
-- Migration: Add auto_skip_intro column to user_preferences
-- Run this in your Supabase SQL Editor
-- ============================================================

ALTER TABLE user_preferences 
  ADD COLUMN IF NOT EXISTS auto_skip_intro boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN user_preferences.auto_skip_intro IS 
  'Preference to automatically click/skip intro and outro buttons in video player.';
