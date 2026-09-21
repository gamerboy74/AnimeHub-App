-- ============================================================
-- Migration: Create user_payments table for billing history
-- Populated by the razorpay-payment Edge Function on every
-- successful payment verification.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_payments (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  razorpay_order_id   text        NOT NULL,
  razorpay_payment_id text        NOT NULL UNIQUE,
  plan_name           text        NOT NULL,               -- 'Monthly' | 'Yearly'
  billing_cycle       text        NOT NULL,               -- 'monthly' | 'yearly'
  amount_paise        integer     NOT NULL,               -- amount in paise
  currency            text        NOT NULL DEFAULT 'INR',
  status              text        NOT NULL DEFAULT 'captured', -- 'captured' | 'refunded'
  period_start        timestamptz NOT NULL,
  period_end          timestamptz NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Index for fast user lookup (billing history query)
CREATE INDEX IF NOT EXISTS idx_user_payments_user_id
  ON public.user_payments(user_id, created_at DESC);

-- RLS
ALTER TABLE public.user_payments ENABLE ROW LEVEL SECURITY;

-- Users can only read their own payment records
CREATE POLICY "user_payments_select_own"
  ON public.user_payments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role (edge functions) can insert payment records
-- Normal clients cannot insert — prevents fake payment records
CREATE POLICY "user_payments_insert_service"
  ON public.user_payments
  FOR INSERT
  WITH CHECK (false); -- blocked for anon/authenticated; service role bypasses RLS
