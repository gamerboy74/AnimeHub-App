/**
 * supabase/functions/razorpay-payment/index.ts
 *
 * Two actions:
 *   POST { action: 'create-order', planId, userId, billingCycle }
 *     → creates a Razorpay order, returns { orderId, amount, currency, keyId }
 *
 *   POST { action: 'verify-payment', orderId, paymentId, signature, userId, planId, billingCycle }
 *     → verifies HMAC-SHA256 signature, then upgrades subscription in DB
 *
 * Environment variables (set in Supabase dashboard → Edge Functions → Secrets):
 *   RAZORPAY_KEY_ID      — your Razorpay Key ID  (rzp_live_xxx or rzp_test_xxx)
 *   RAZORPAY_KEY_SECRET  — your Razorpay Key Secret
 *   SUPABASE_URL         — auto-injected by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected; used to bypass RLS for server-side writes
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RAZORPAY_KEY_ID      = Deno.env.get('RAZORPAY_KEY_ID')!;
const RAZORPAY_KEY_SECRET  = Deno.env.get('RAZORPAY_KEY_SECRET')!;
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Plan prices in smallest currency unit (paise for INR)
const PLAN_AMOUNT: Record<string, number> = {
  monthly:  9900,  // Rs. 99
  yearly:  79900,  // Rs. 799
};

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// HMAC-SHA256 via Web Crypto API (no external deps needed)
async function hmacSha256(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function razorpayRequest(path: string, body?: unknown, method = 'POST') {
  const credentials = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
  const reqOptions: RequestInit = {
    method,
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type':  'application/json',
    },
  };
  if (body !== undefined && method !== 'GET') {
    reqOptions.body = JSON.stringify(body);
  }
  const res = await fetch(`https://api.razorpay.com/v1${path}`, reqOptions);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Razorpay API error ${res.status}: ${err}`);
  }
  return res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Verify caller identity from JWT
    let callerUser: { id: string } | null = null;
    if (token) {
      const { data: authData } = await supabase.auth.getUser(token);
      if (authData?.user) callerUser = authData.user;
    }

    const body = await req.json();
    const { action } = body;

    // ── CREATE ORDER ──────────────────────────────────────────────────────────
    if (action === 'create-order') {
      const { planId, userId, billingCycle } = body;

      if (!planId || !userId || !billingCycle) {
        return Response.json(
          { error: 'planId, userId, billingCycle are required' },
          { status: 400, headers: corsHeaders },
        );
      }

      // Security check: caller must match the requested userId
      if (!callerUser || callerUser.id !== userId) {
        return Response.json(
          { error: 'Unauthorized: Caller does not match userId' },
          { status: 401, headers: corsHeaders },
        );
      }

      // Fetch dynamic plan price from the database table (subscription_plans)
      let amount: number | undefined = PLAN_AMOUNT[billingCycle];
      let currency = 'INR';

      try {
        const cleanPlanId = String(planId).replace(/[^a-zA-Z0-9_-]/g, '');
        const cleanCycle = String(billingCycle).replace(/[^a-zA-Z0-9_-]/g, '');
        const { data: planRow, error: planErr } = await supabase
          .from('subscription_plans')
          .select('id, price_paise, currency, billing_cycle, is_active')
          .or(`id.eq.${cleanPlanId},billing_cycle.eq.${cleanCycle},name.eq.${cleanPlanId}`)
          .eq('is_active', true)
          .order('price_paise', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!planErr && planRow && planRow.price_paise > 0) {
          amount = planRow.price_paise;
          currency = planRow.currency || 'INR';
        }
      } catch (dbErr) {
        console.warn('[razorpay-payment] Failed to fetch dynamic plan price from DB, using fallback:', dbErr);
      }

      if (!amount) {
        return Response.json(
          { error: `Unknown or inactive plan/billingCycle: ${billingCycle}` },
          { status: 400, headers: corsHeaders },
        );
      }

      const order = await razorpayRequest('/orders', {
        amount,
        currency,
        receipt:         `uid_${userId.substring(0, 8)}_${Date.now()}`,
        notes:           { user_id: userId, plan_id: planId, billing_cycle: billingCycle },
        payment_capture: 1, // auto-capture on success
      });

      return Response.json(
        { orderId: order.id, amount: order.amount, currency: order.currency, keyId: RAZORPAY_KEY_ID },
        { headers: corsHeaders },
      );
    }

    // ── VERIFY PAYMENT ────────────────────────────────────────────────────────
    if (action === 'verify-payment') {
      const { orderId, paymentId, signature, userId, billingCycle, planId } = body;

      if (!orderId || !paymentId || !signature || !userId || !billingCycle) {
        return Response.json(
          { error: 'Missing required verification fields' },
          { status: 400, headers: corsHeaders },
        );
      }

      // Security check 1: caller must match requested userId
      if (!callerUser || callerUser.id !== userId) {
        return Response.json(
          { error: 'Unauthorized: Caller does not match userId' },
          { status: 401, headers: corsHeaders },
        );
      }

      // Security check 2: Verify HMAC-SHA256 signature
      const expected = await hmacSha256(RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`);
      if (expected !== signature) {
        return Response.json({ error: 'Invalid payment signature' }, {
          status: 400, headers: corsHeaders,
        });
      }

      // Security check 3: Verify the Razorpay order notes belong to this user
      try {
        const rzpOrder = await razorpayRequest(`/orders/${orderId}`, undefined, 'GET');
        const orderUserId = rzpOrder?.notes?.user_id;
        if (orderUserId && orderUserId !== userId) {
          return Response.json({ error: 'Security violation: Order was created for a different account' }, {
            status: 403, headers: corsHeaders,
          });
        }
      } catch (orderCheckErr) {
        console.warn('[razorpay-payment] Order ownership check warning:', orderCheckErr);
      }

      // 2. Signature is valid — upgrade subscription using service role (bypasses RLS)
      const renewalMs  = billingCycle === 'yearly' ? 365 * 86_400_000 : 30 * 86_400_000;
      const now        = new Date().toISOString();
      const renewal    = new Date(Date.now() + renewalMs).toISOString();

      // Fetch actual amount from Razorpay to store truthfully
      let capturedAmount = billingCycle === 'yearly' ? 79900 : 9900;
      try {
        const rzpPayment = await razorpayRequest(`/payments/${paymentId}`, undefined, 'GET');
        if (rzpPayment?.amount) capturedAmount = rzpPayment.amount;
      } catch { /* fallback to plan default */ }

      const { error: userErr } = await supabase
        .from('users')
        .update({
          subscription_type: 'premium',
          billing_cycle: billingCycle,
          subscription_started_at: now,
          subscription_expires_at: renewal,
          cancel_at_period_end: false,
        })
        .eq('id', userId);

      if (userErr) throw new Error(`Failed to upgrade user: ${userErr.message}`);

      const { error: prefErr } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          subscription_meta: {
            billing_cycle:       billingCycle,
            plan_id:             planId ?? null,
            subscribed_at:       now,
            next_renewal:        renewal,
            razorpay_order_id:   orderId,
            razorpay_payment_id: paymentId,
          },
        }, { onConflict: 'user_id' });

      if (prefErr) throw new Error(`Failed to write subscription meta: ${prefErr.message}`);

      // 2b. Write payment record to user_payments for billing history
      await supabase.from('user_payments').upsert({
        user_id:             userId,
        razorpay_order_id:   orderId,
        razorpay_payment_id: paymentId,
        plan_name:           billingCycle === 'yearly' ? 'Yearly' : 'Monthly',
        billing_cycle:       billingCycle,
        amount_paise:        capturedAmount,
        currency:            'INR',
        status:              'captured',
        period_start:        now,
        period_end:          renewal,
      }, { onConflict: 'razorpay_payment_id', ignoreDuplicates: true }); // idempotent

      // 3. Send welcome notification to user's inbox
      const formattedDate = new Date(renewal).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'system',
        title: 'Welcome to Premium!',
        message: `Your ${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'} plan is activated until ${formattedDate}. Enjoy 2-device simultaneous streaming, 0 ads, and 1080p HD!`,
        read: false,
        action_url: '/manage-plan',
      });

      // 4. Send Expo push notification if device push token is registered
      try {
        const { data: tokens } = await supabase
          .from('user_push_tokens')
          .select('token')
          .eq('user_id', userId);

        if (tokens && tokens.length > 0) {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(
              tokens.map((t: { token: string }) => ({
                to: t.token,
                sound: 'default',
                title: '⭐ Welcome to AnimeHub Premium!',
                body: `Your ${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'} plan is now active. Enjoy unlimited streaming!`,
                channelId: 'default',
                data: { action_url: '/manage-plan' },
              })),
            ),
          });
        }
      } catch (pushErr) {
        console.warn('Push notification delivery skipped:', pushErr);
      }

      return Response.json({ success: true, nextRenewal: renewal }, { headers: corsHeaders });
    }

    // ── CHECK ORDER STATUS ──────────────────────────────────────────────────
    if (action === 'check-order-status') {
      const { orderId, userId, planId, billingCycle } = body;

      if (!orderId || !userId) {
        return Response.json(
          { error: 'orderId and userId are required' },
          { status: 400, headers: corsHeaders },
        );
      }

      // Security check: caller must match requested userId
      if (!callerUser || callerUser.id !== userId) {
        return Response.json(
          { error: 'Unauthorized: Caller does not match userId' },
          { status: 401, headers: corsHeaders },
        );
      }

      // Check if user already got upgraded by webhook or prior verification
      const { data: userRow } = await supabase
        .from('users')
        .select('subscription_type, subscription_expires_at')
        .eq('id', userId)
        .maybeSingle();

      if (userRow?.subscription_type === 'premium') {
        return Response.json({
          status: 'paid',
          alreadyUpgraded: true,
          nextRenewal: userRow.subscription_expires_at,
        }, { headers: corsHeaders });
      }

      // Query Razorpay API for payments associated with this order
      try {
        const payments = await razorpayRequest(`/orders/${orderId}/payments`, undefined, 'GET');
        const items = payments?.items || [];
        const successfulPayment = items.find((p: any) =>
          p.status === 'captured' || p.status === 'authorized'
        );

        if (successfulPayment) {
          const notes = successfulPayment.notes || {};

          // Security check: Verify order belongs to this user
          if (notes.user_id && notes.user_id !== userId) {
            return Response.json({ error: 'Security violation: Order belongs to another user' }, {
              status: 403, headers: corsHeaders,
            });
          }

          const cycle = (billingCycle || notes.billing_cycle as 'monthly' | 'yearly') || 'monthly';
          const resolvedPlanId = planId || notes.plan_id;
          const renewalMs = cycle === 'yearly' ? 365 * 86_400_000 : 30 * 86_400_000;
          const now = new Date().toISOString();
          const renewal = new Date(Date.now() + renewalMs).toISOString();

          await supabase.from('users').update({
            subscription_type: 'premium',
            billing_cycle: cycle,
            subscription_started_at: now,
            subscription_expires_at: renewal,
            cancel_at_period_end: false,
          }).eq('id', userId);

          await supabase.from('user_preferences').upsert({
            user_id: userId,
            subscription_meta: {
              billing_cycle: cycle,
              plan_id: resolvedPlanId ?? null,
              subscribed_at: now,
              next_renewal: renewal,
              razorpay_order_id: orderId,
              razorpay_payment_id: successfulPayment.id,
              verified_via: 'check_order_status',
            },
          }, { onConflict: 'user_id' });

          // Record in user_payments for billing history
          await supabase.from('user_payments').upsert({
            user_id:             userId,
            razorpay_order_id:   orderId,
            razorpay_payment_id: successfulPayment.id,
            plan_name:           cycle === 'yearly' ? 'Yearly' : 'Monthly',
            billing_cycle:       cycle,
            amount_paise:        successfulPayment.amount || (cycle === 'yearly' ? 79900 : 9900),
            currency:            'INR',
            status:              'captured',
            period_start:        now,
            period_end:          renewal,
          }, { onConflict: 'razorpay_payment_id', ignoreDuplicates: true });

          const formattedDate = new Date(renewal).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });
          await supabase.from('notifications').insert({
            user_id: userId,
            type: 'system',
            title: 'Welcome to Premium!',
            message: `Your ${cycle === 'yearly' ? 'Yearly' : 'Monthly'} plan is activated until ${formattedDate}. Enjoy ad-free 4K streaming and downloads!`,
            read: false,
            action_url: '/manage-plan',
          }).catch(() => {});

          return Response.json({
            status: 'paid',
            paymentId: successfulPayment.id,
            nextRenewal: renewal,
          }, { headers: corsHeaders });
        }
      } catch (checkErr) {
        console.warn('[razorpay-payment] Could not check order payments from Razorpay API:', checkErr);
      }

      return Response.json({
        status: 'unpaid',
      }, { headers: corsHeaders });
    }

    return Response.json({ error: `Unknown action: ${action}` }, {
      status: 400, headers: corsHeaders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
