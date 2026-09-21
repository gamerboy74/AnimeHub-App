-- ============================================================
-- Migration: Update subscription prices + subscription lifecycle
-- Run in Supabase SQL Editor → New Query → Run
-- ============================================================

-- ── 1. Update prices to Rs.99/month and Rs.799/year ──────────
UPDATE subscription_plans
SET
  price_paise  = 9900,   -- Rs. 99
  savings_text = NULL,   -- clear old savings text first
  updated_at   = now()
WHERE name = 'premium_monthly';

UPDATE subscription_plans
SET
  price_paise  = 79900,              -- Rs. 799
  savings_text = '₹67/mo · Save 33%', -- 799/12 = ~67/mo vs 99/mo normal
  badge        = 'BEST VALUE',
  updated_at   = now()
WHERE name = 'premium_yearly';

-- Verify the update
SELECT name, display_name, price_paise, savings_text
FROM subscription_plans
ORDER BY sort_order;

-- ── 2. Enable pg_net extension (needed for cron HTTP calls) ───
-- This is usually already enabled on Supabase.
-- If you get "extension already exists" that is fine.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ── 3. Enable pg_cron extension ───────────────────────────────
-- Available on Supabase Pro plan. On Free plan, use an external cron.
-- To check if available: SELECT * FROM pg_extension WHERE extname = 'pg_cron';
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- ── 4. Schedule daily expiry sweep (runs at 00:00 UTC = 05:30 IST) ─
-- Replace <YOUR_SERVICE_ROLE_KEY> with your Supabase service role key
-- from: Supabase Dashboard -> Project Settings -> API -> service_role
SELECT cron.schedule(
  'animehub-subscription-expire-daily',   -- job name (must be unique)
  '0 0 * * *',                            -- every day at midnight UTC
  format(
    $cron_body$
    SELECT net.http_post(
      url     := 'https://ieopfdxgjlmdsidikgbj.supabase.co/functions/v1/subscription-manager',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer %s"}'::jsonb,
      body    := '{"action":"expire"}'::jsonb
    );
    $cron_body$,
    current_setting('app.service_role_key', true)  -- set this below OR paste key directly
  )
);

-- ── 5. Schedule daily renewal reminders (runs at 10:00 UTC = 3:30 PM IST) ─
SELECT cron.schedule(
  'animehub-subscription-remind-daily',
  '0 10 * * *',
  format(
    $cron_body$
    SELECT net.http_post(
      url     := 'https://ieopfdxgjlmdsidikgbj.supabase.co/functions/v1/subscription-manager',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer %s"}'::jsonb,
      body    := '{"action":"remind"}'::jsonb
    );
    $cron_body$,
    current_setting('app.service_role_key', true)
  )
);

-- ── ALTERNATIVE: If pg_cron is not available (Free plan), ────
-- use this simpler approach instead of steps 4-5:
-- Set up a free external cron at https://cron-job.org
-- POST https://ieopfdxgjlmdsidikgbj.supabase.co/functions/v1/subscription-manager
-- Header: Authorization: Bearer <service_role_key>
-- Body: {"action":"expire"}
-- Schedule: 0 0 * * * (daily at midnight)

-- ── 6. Verify cron jobs registered ───────────────────────────
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname LIKE 'animehub-%';
