-- ============================================================
-- Migration: Add localization and security preferences columns to user_preferences
-- Run this in your Supabase SQL Editor
-- ============================================================

ALTER TABLE user_preferences 
  ADD COLUMN IF NOT EXISTS audio_preference text NOT NULL DEFAULT 'Japanese (Original)',
  ADD COLUMN IF NOT EXISTS two_factor_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN user_preferences.audio_preference IS 
  'Default preferred audio track style (e.g. Japanese (Original) or English Dub).';

COMMENT ON COLUMN user_preferences.two_factor_enabled IS 
  'Security setting indicating if two-factor authentication is active.';
