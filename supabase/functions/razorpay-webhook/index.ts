/**
 * supabase/functions/razorpay-webhook/index.ts
 *
 * Razorpay Server-to-Server Webhook Handler
 * Listens for:
 *   - 'order.paid'
 *   - 'payment.captured'
 *
 * Ensures subscription upgrades are 100% reliable even if the user's
 * phone crashes, loses internet, or closes the app during payment.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RAZORPAY_KEY_SECRET     = Deno.env.get('RAZORPAY_KEY_SECRET') || '';
const RAZORPAY_WEBHOOK_SECRET = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') || RAZORPAY_KEY_SECRET;
const SUPABASE_URL            = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
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

async function sendPush(db: SupabaseClient, userId: string, title: string, body: string) {
  try {
    const { data: tokens } = await db
      .from('user_push_tokens')
      .select('token')
      .eq('user_id', userId);

    if (!tokens || tokens.length === 0) return;

    // Build messages — channelId is REQUIRED for Android 8+ banners
    const messages = tokens.map((t: { token: string }) => ({
      to: t.token,
      sound: 'default',
      title,
      body,
      channelId: 'default',                   // ← REQUIRED for Android 8+ banners
      data: { action_url: '/manage-plan' },    // ← must be action_url (matches usePushNotifications tap handler)
    }));

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      console.warn('[Push] Expo push API returned non-OK:', res.status);
      return;
    }

    // Prune stale/invalid tokens to keep the table clean
    const result = await res.json();
    const tickets: Array<{ status: string; details?: { error?: string } }> = result?.data ?? [];
    const staleTokens: string[] = [];
    tickets.forEach((ticket, i) => {
      if (
        ticket.status === 'error' &&
        ticket.details?.error === 'DeviceNotRegistered'
      ) {
        staleTokens.push(tokens[i].token);
      }
    });
    if (staleTokens.length > 0) {
      await db
        .from('user_push_tokens')
        .delete()
        .in('token', staleTokens);
    }
  } catch (err) {
    console.warn('[Webhook] Push notification error:', err);
  }
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature') || '';

    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing x-razorpay-signature header' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify webhook signature with webhook secret (or key secret)
    const expectedSignature = await hmacSha256Hex(RAZORPAY_WEBHOOK_SECRET, rawBody);
    if (expectedSignature !== signature) {
      // Also try key secret if separate webhook secret was configured differently
      const fallbackSignature = await hmacSha256Hex(RAZORPAY_KEY_SECRET, rawBody);
      if (fallbackSignature !== signature) {
        console.error('[Webhook] Invalid signature received from Razorpay');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.event;
    console.log(`[Webhook] Processing verified Razorpay event: ${eventType}`);

    if (eventType === 'order.paid' || eventType === 'payment.captured') {
      const paymentEntity = payload.payload?.payment?.entity;
      const orderEntity   = payload.payload?.order?.entity;

      const notes = paymentEntity?.notes || orderEntity?.notes || {};
      const userId = notes.user_id as string | undefined;
      const billingCycle = (notes.billing_cycle as 'monthly' | 'yearly') || 'monthly';
      const planId = notes.plan_id as string | undefined;
      const orderId = paymentEntity?.order_id || orderEntity?.id;
      const paymentId = paymentEntity?.id;

      if (!userId) {
        console.warn('[Webhook] Event without user_id in notes. Skipping fulfillment.');
        return new Response(JSON.stringify({ status: 'ignored_missing_user' }), { status: 200 });
      }

      const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { persistSession: false },
      });

      // Calculate duration: 30 days for monthly, 365 days for yearly
      const renewalMs = billingCycle === 'yearly' ? 365 * 86_400_000 : 30 * 86_400_000;
      const now = new Date().toISOString();
      const renewal = new Date(Date.now() + renewalMs).toISOString();

      // 1. Upgrade user in users table
      const { error: userErr } = await db
        .from('users')
        .update({
          subscription_type: 'premium',
          billing_cycle: billingCycle,
          subscription_started_at: now,
          subscription_expires_at: renewal,
          cancel_at_period_end: false,
        })
        .eq('id', userId);

      if (userErr) {
        console.error(`[Webhook] Failed updating users table for ${userId}:`, userErr.message);
        throw userErr;
      }

      // 2. Upsert subscription metadata in user_preferences
      const { error: prefErr } = await db
        .from('user_preferences')
        .upsert(
          {
            user_id: userId,
            subscription_meta: {
              billing_cycle: billingCycle,
              plan_id: planId ?? null,
              subscribed_at: now,
              next_renewal: renewal,
              cancel_at_period_end: false,
              razorpay_order_id: orderId ?? null,
              razorpay_payment_id: paymentId ?? null,
              fulfilled_via: 'webhook',
            },
          },
          { onConflict: 'user_id' },
        );

      if (prefErr) {
        console.error(`[Webhook] Failed writing subscription_meta:`, prefErr.message);
      }

      // 2b. Record transaction in user_payments for billing history
      if (paymentId) {
        const amountPaise = paymentEntity?.amount || (billingCycle === 'yearly' ? 79900 : 9900);
        const currency = paymentEntity?.currency || 'INR';
        await db.from('user_payments').upsert({
          user_id:             userId,
          razorpay_order_id:   orderId ?? null,
          razorpay_payment_id: paymentId,
          plan_name:           billingCycle === 'yearly' ? 'Yearly' : 'Monthly',
          billing_cycle:       billingCycle,
          amount_paise:        amountPaise,
          currency:            currency,
          status:              'captured',
          period_start:        now,
          period_end:          renewal,
        }, { onConflict: 'razorpay_payment_id', ignoreDuplicates: true });
      }

      // 3. Send in-app notification
      const formattedDate = new Date(renewal).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      await db.from('notifications').insert({
        user_id: userId,
        type: 'system',
        title: 'Payment Confirmed!',
        message: `Your ${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'} Premium plan has been confirmed. Enjoy 2-device playback, zero ads, and 1080p HD until ${formattedDate}!`,
        read: false,
        action_url: '/manage-plan',
      }).catch(() => {});

      // 4. Send device push notification
      await sendPush(
        db,
        userId,
        '⭐ Payment Confirmed!',
        `Your ${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'} Premium subscription is active until ${formattedDate}.`,
      );

      console.log(`[Webhook] Successfully fulfilled subscription for user ${userId} (${billingCycle})`);
      return new Response(JSON.stringify({ status: 'fulfilled', userId, renewal }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ status: 'unhandled_event', eventType }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('[Webhook] Exception:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
