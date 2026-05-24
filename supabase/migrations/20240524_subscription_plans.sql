-- ============================================================
-- Migration: Subscription Plans + Feature Matrix
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ── 1. subscription_plans ────────────────────────────────────
-- Stores each purchasable plan. Admin edits price/badge here.
CREATE TABLE IF NOT EXISTS subscription_plans (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL UNIQUE,          -- internal key: 'free' | 'premium_monthly' | 'premium_yearly'
  display_name  text        NOT NULL,                 -- 'Monthly' | 'Yearly'
  tier          text        NOT NULL DEFAULT 'free',  -- 'free' | 'premium'
  price_paise   integer     NOT NULL DEFAULT 0,       -- amount in paise (₹149 = 14900, ₹0 = 0)
  currency      text        NOT NULL DEFAULT 'INR',
  billing_cycle text,                                 -- 'monthly' | 'yearly' | NULL (for free)
  badge         text,                                 -- NULL | 'BEST VALUE' | 'POPULAR'
  savings_text  text,                                 -- '₹83/month · Save 44%'
  sort_order    integer     NOT NULL DEFAULT 0,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 2. plan_features ─────────────────────────────────────────
-- Stores each row of the feature comparison table.
-- Admin can add/remove/reorder rows without an app update.
CREATE TABLE IF NOT EXISTS plan_features (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  label          text    NOT NULL,            -- 'HD & 4K Quality'
  sub_label      text,                        -- optional description
  free_value     text    NOT NULL DEFAULT '✓',  -- '✓' | '✗' | 'Up to 720p' | '1 device'
  premium_value  text    NOT NULL DEFAULT '✓',  -- '✓' | '✗' | 'Up to 4K'  | '2 devices'
  is_highlighted boolean NOT NULL DEFAULT false,
  sort_order     integer NOT NULL DEFAULT 0,
  is_active      boolean NOT NULL DEFAULT true
);

-- ── 3. Enable Row Level Security (read-only for anon) ─────────
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_features      ENABLE ROW LEVEL SECURITY;

-- Anyone (including logged-out users) can read active plans
CREATE POLICY "public_read_plans"
  ON subscription_plans FOR SELECT
  USING (is_active = true);

CREATE POLICY "public_read_features"
  ON plan_features FOR SELECT
  USING (is_active = true);

-- Only admins can write (handled by Supabase dashboard / service role)

-- ── 4. Seed data ──────────────────────────────────────────────
INSERT INTO subscription_plans (name, display_name, tier, price_paise, billing_cycle, badge, savings_text, sort_order)
VALUES
  ('free',             'Free',    'free',    0,     NULL,      NULL,         NULL,                 0),
  ('premium_monthly',  'Monthly', 'premium', 14900, 'monthly', NULL,         NULL,                 1),
  ('premium_yearly',   'Yearly',  'premium', 99900, 'yearly',  'BEST VALUE', '₹83/mo · Save 44%', 2)
ON CONFLICT (name) DO NOTHING;

INSERT INTO plan_features (label, free_value, premium_value, is_highlighted, sort_order)
VALUES
  ('Anime Library',           '✓',          '✓',           false, 0),
  ('Free Episodes',           '✓',          '✓',           false, 1),
  ('Premium Episodes',        '✗',          '✓',           true,  2),
  ('Video Quality',           'Up to 720p', 'Up to 4K',    true,  3),
  ('Ads',                     'With ads',   'Ad-free',     true,  4),
  ('Simultaneous Streams',    '1 device',   '2 devices',   false, 5),
  ('Offline Downloads',       '✗',          '✓',           false, 6),
  ('Early Episode Access',    '✗',          '✓',           false, 7),
  ('New Episode Alerts',      '✓',          '✓',           false, 8),
  ('Watchlist & Favorites',   '✓',          '✓',           false, 9),
  ('Community Reviews',       '✓',          '✓',           false, 10),
  ('Customer Support',        'Standard',   'Priority',    false, 11)
ON CONFLICT DO NOTHING;

-- ── 5. updated_at trigger for subscription_plans ─────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
