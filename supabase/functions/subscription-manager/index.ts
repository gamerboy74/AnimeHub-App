/**
 * supabase/functions/subscription-manager/index.ts
 *
 * Subscription lifecycle management — handles:
 *
 *   1. EXPIRY SWEEP  (action: 'expire')
 *      Finds all premium users whose next_renewal < NOW() and downgrades them to free.
 *      Sends a "your subscription expired" in-app notification.
 *      Schedule this via Supabase Cron (pg_cron) to run daily at midnight UTC.
 *
 *   2. RENEWAL REMINDER (action: 'remind')
 *      Finds premium users whose next_renewal is 3 days away and haven't been reminded.
 *      Sends a "renew soon" in-app notification.
 *      Schedule daily too — it's idempotent.
 *
 *   3. UPGRADE  (action: 'upgrade', userId, billingCycle, razorpayOrderId, razorpayPaymentId)
 *      Called internally after Razorpay payment verified — upgrades a specific user.
 *      You can also call this from manage-plan to switch billing cycle.
 *
 *   4. STATUS  (action: 'status', userId)
 *      Returns the current subscription state for a user (for debug / admin panel).
 *
 * ── Scheduling via pg_cron ───────────────────────────────────────────────────
 * In Supabase SQL Editor run:
 *
 *   select cron.schedule(
 *     'subscription-expire-daily',
 *     '0 0 * * *',   -- every day at 00:00 UTC
 *     $$
 *       select net.http_post(
 *         url := 'https://ieopfdxgjlmdsidikgbj.supabase.co/functions/v1/subscription-manager',
 *         headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
 *         body := '{"action":"expire"}'::jsonb
 *       );
 *     $$
 *   );
 *
 *   select cron.schedule(
 *     'subscription-remind-daily',
 *     '0 10 * * *',  -- every day at 10:00 UTC (3:30 PM IST)
 *     $$
 *       select net.http_post(
 *         url := 'https://ieopfdxgjlmdsidikgbj.supabase.co/functions/v1/subscription-manager',
 *         headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
 *         body := '{"action":"remind"}'::jsonb
 *       );
 *     $$
 *   );
 *
 * ── Env vars (same as razorpay-payment function) ────────────────────────────
 *   SUPABASE_URL              — auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected (or add manually for local testing)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Push Notification helper (Expo Push API) ────────────────────────────────
async function sendPushNotification(
  db: SupabaseClient,
  userId: string,
  title: string,
  body: string,
  url: string = '/plans',
) {
  try {
    const { data: tokens } = await db
      .from('user_push_tokens')
      .select('token')
      .eq('user_id', userId);

    if (!tokens || tokens.length === 0) return;

    // channelId is REQUIRED for Android 8+ banners to appear
    const messages = tokens.map((t: { token: string }) => ({
      to: t.token,
      sound: 'default',
      title,
      body,
      channelId: 'default',             // ← REQUIRED for Android 8+ banners
      data: { action_url: url },        // ← action_url matches the tap handler in usePushNotifications
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
      console.warn(`[Push] Expo push API returned non-OK for user ${userId}:`, res.status);
      return;
    }

    // Prune DeviceNotRegistered tokens so they don't accumulate
    const result = await res.json();
    const tickets: Array<{ status: string; details?: { error?: string } }> = result?.data ?? [];
    const staleTokens: string[] = [];
    tickets.forEach((ticket, i) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        staleTokens.push(tokens[i].token);
      }
    });
    if (staleTokens.length > 0) {
      await db.from('user_push_tokens').delete().in('token', staleTokens);
    }
  } catch (err) {
    console.warn(`[Push] Push notification skipped for user ${userId}:`, err);
  }
}

// ─── Notification helper ─────────────────────────────────────────────────────
async function sendNotification(
  db: SupabaseClient,
  userId: string,
  type: string,
  title: string,
  message: string,
  actionUrl?: string,
) {
  await db.from('notifications').insert({
    user_id:    userId,
    type,
    title,
    message,
    read:       false,
    action_url: actionUrl ?? null,
  });

  // Also trigger device push notification
  await sendPushNotification(db, userId, title, message, actionUrl ?? '/plans');
}

// ─── Action: expire ──────────────────────────────────────────────────────────
// Downgrades users whose subscription has lapsed. Runs at midnight daily.
async function expireSubscriptions(db: SupabaseClient) {
  const now = new Date().toISOString();

  // 1. Primary check: Query users table directly (single source of truth)
  const { data: expiredUsers, error: usersErr } = await db
    .from('users')
    .select('id, billing_cycle, subscription_expires_at')
    .eq('subscription_type', 'premium')
    .not('subscription_expires_at', 'is', null)
    .lte('subscription_expires_at', now);

  if (usersErr) throw new Error(`Failed to query expired users: ${usersErr.message}`);

  const expiredSet = new Set<string>(
    (expiredUsers ?? [])
      .filter(u => u.billing_cycle !== 'admin_grant')
      .map(u => u.id)
  );

  // 2. Secondary check: Legacy preferences records if any exist
  const { data: prefs } = await db
    .from('user_preferences')
    .select('user_id, subscription_meta')
    .not('subscription_meta', 'is', null);

  for (const pref of (prefs ?? [])) {
    const meta = pref.subscription_meta as Record<string, unknown> | null;
    if (!meta) continue;
    if (meta.billing_cycle === 'admin_grant') continue;
    if (meta.next_renewal && new Date(meta.next_renewal as string) <= new Date(now)) {
      expiredSet.add(pref.user_id as string);
    }
  }

  const expiredUserIds = Array.from(expiredSet);

  if (expiredUserIds.length === 0) {
    return { expired: 0, message: 'No expired subscriptions found' };
  }

  // Batch downgrade users table (clear subscription_type, billing_cycle, and subscription_expires_at)
  const { error: downgradeErr } = await db
    .from('users')
    .update({ 
      subscription_type: 'free',
      billing_cycle: null,
      subscription_expires_at: null,
      cancel_at_period_end: false,
    })
    .in('id', expiredUserIds);

  if (downgradeErr) throw new Error(`Batch downgrade failed: ${downgradeErr.message}`);

  // Clear legacy subscription_meta for expired users
  const { error: clearErr } = await db
    .from('user_preferences')
    .update({ subscription_meta: null })
    .in('user_id', expiredUserIds);

  if (clearErr) throw new Error(`Failed to clear subscription meta: ${clearErr.message}`);

  // Send in-app and push notifications per user
  for (const userId of expiredUserIds) {
    await sendNotification(
      db,
      userId,
      'system',
      'Subscription Expired',
      'Your AnimeHub Premium subscription has expired. Renew now to restore unlimited access, ad-free streaming, and HD quality.',
      '/plans',
    );
  }

  return { expired: expiredUserIds.length, userIds: expiredUserIds };
}

// ─── Action: remind ──────────────────────────────────────────────────────────
// Multi-stage renewal reminders:
// - 3 days before expiry
// - 2 days before expiry
// - 1 day before expiry (Tomorrow)
async function sendRenewalReminders(db: SupabaseClient) {
  const { data: prefs, error } = await db
    .from('user_preferences')
    .select('user_id, subscription_meta')
    .not('subscription_meta', 'is', null);

  if (error) throw new Error(`Failed to fetch preferences: ${error.message}`);

  let remindedCount = 0;

  for (const pref of (prefs ?? [])) {
    const meta = pref.subscription_meta as Record<string, unknown> | null;
    if (!meta) continue;

    const userId       = pref.user_id as string;
    const billingCycle = meta.billing_cycle as string | undefined;
    const nextRenewal  = meta.next_renewal  as string | undefined;
    const lastStage    = meta.last_reminder_stage as string | undefined;

    if (billingCycle === 'admin_grant') continue;
    if (!nextRenewal) continue;

    const renewal = new Date(nextRenewal);
    const msRemaining = renewal.getTime() - Date.now();
    const daysRemaining = Math.ceil(msRemaining / 86_400_000);

    // If already expired, let expireSubscriptions handle it
    if (daysRemaining <= 0) continue;

    let stage: string | null = null;
    let title = '';
    let message = '';

    if (daysRemaining === 1 && lastStage !== '1_day') {
      stage = '1_day';
      title = '⚠️ AnimeHub Premium Expires Tomorrow';
      message = 'Your AnimeHub Premium subscription expires tomorrow! Renew your plan today to keep unlimited HD streaming and multi-device access.';
    } else if (daysRemaining === 2 && lastStage !== '2_days' && lastStage !== '1_day') {
      stage = '2_days';
      title = 'AnimeHub Premium Expires in 2 Days';
      message = 'Your AnimeHub Premium subscription expires in 2 days. Renew now to avoid interruption to ad-free and HD anime streaming.';
    } else if (daysRemaining === 3 && !lastStage) {
      stage = '3_days';
      title = 'AnimeHub Premium Renews in 3 Days';
      message = 'Your AnimeHub Premium subscription renews in 3 days. Check your plan settings to ensure uninterrupted streaming.';
    }

    if (!stage) continue;

    // Send in-app notification + push notification
    await sendNotification(db, userId, 'system', title, message, '/plans');

    // Update reminder stage so user is not re-spammed for the same stage
    await db
      .from('user_preferences')
      .update({
        subscription_meta: {
          ...meta,
          last_reminder_stage: stage,
          reminder_sent_at: new Date().toISOString(),
        },
      })
      .eq('user_id', userId);

    remindedCount++;
  }

  return { reminded: remindedCount };
}

// ─── Action: upgrade ─────────────────────────────────────────────────────────
// Upgrades a specific user. Called after payment verification.
async function upgradeUser(
  db: SupabaseClient,
  userId: string,
  billingCycle: 'monthly' | 'yearly',
  extraMeta: Record<string, unknown> = {},
) {
  const renewalMs = billingCycle === 'yearly' ? 365 * 86_400_000 : 30 * 86_400_000;
  const now       = new Date().toISOString();
  const renewal   = new Date(Date.now() + renewalMs).toISOString();

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

  if (userErr) throw new Error(`User upgrade failed: ${userErr.message}`);

  const { error: prefErr } = await db
    .from('user_preferences')
    .upsert(
      {
        user_id: userId,
        subscription_meta: {
          billing_cycle:       billingCycle,
          subscribed_at:       now,
          next_renewal:        renewal,
          last_reminder_stage: null,
          ...extraMeta,
        },
      },
      { onConflict: 'user_id' },
    );

  if (prefErr) throw new Error(`Pref write failed: ${prefErr.message}`);

  await sendNotification(
    db,
    userId,
    'system',
    'Welcome to Premium!',
    `You're now on the ${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'} Premium plan. Enjoy unlimited access, zero ads, and HD streaming!`,
    '/plans',
  );

  return { success: true, nextRenewal: renewal };
}

// ─── Action: status ──────────────────────────────────────────────────────────
async function getUserStatus(db: SupabaseClient, userId: string) {
  const [userRes, prefRes] = await Promise.all([
    db.from('users').select('subscription_type, email, username').eq('id', userId).single(),
    db.from('user_preferences').select('subscription_meta').eq('user_id', userId).maybeSingle(),
  ]);

  const meta = prefRes.data?.subscription_meta as Record<string, unknown> | null;
  const nextRenewal = meta?.next_renewal as string | undefined;
  const daysLeft = nextRenewal
    ? Math.max(0, Math.ceil((new Date(nextRenewal).getTime() - Date.now()) / 86_400_000))
    : null;

  return {
    user:          userRes.data,
    meta,
    daysLeft,
    isExpired:     nextRenewal ? new Date(nextRenewal) < new Date() : false,
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Security check: Guard privileged actions
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const isServiceRole = token === SUPABASE_SERVICE_KEY;

    switch (action) {
      case 'expire': {
        // Safe to run by cron or client triggered sweep since it strictly checks expires_at <= now()
        const result = await expireSubscriptions(db);
        return Response.json(result, { headers: corsHeaders });
      }

      case 'remind': {
        if (!isServiceRole) {
          return Response.json({ error: 'Unauthorized: Service role key required for reminder sweep' }, {
            status: 403, headers: corsHeaders,
          });
        }
        const result = await sendRenewalReminders(db);
        return Response.json(result, { headers: corsHeaders });
      }

      case 'upgrade': {
        // STRICT SECURITY GUARD: Upgrades must NEVER be callable by arbitrary clients
        if (!isServiceRole) {
          return Response.json({ error: 'Unauthorized: Subscription upgrades require verified payment processing' }, {
            status: 403, headers: corsHeaders,
          });
        }
        const { userId, billingCycle, razorpayOrderId, razorpayPaymentId } = body;
        if (!userId || !billingCycle) {
          return Response.json({ error: 'userId and billingCycle are required' }, {
            status: 400, headers: corsHeaders,
          });
        }
        const result = await upgradeUser(db, userId, billingCycle, {
          razorpay_order_id:   razorpayOrderId ?? null,
          razorpay_payment_id: razorpayPaymentId ?? null,
        });
        return Response.json(result, { headers: corsHeaders });
      }

      case 'status': {
        const { userId } = body;
        if (!userId) {
          return Response.json({ error: 'userId is required' }, {
            status: 400, headers: corsHeaders,
          });
        }

        // Verify that caller owns this userId or is service_role
        if (!isServiceRole) {
          if (!token) {
            return Response.json({ error: 'Authentication required' }, { status: 401, headers: corsHeaders });
          }
          const { data: authData, error: authErr } = await db.auth.getUser(token);
          if (authErr || !authData?.user || authData.user.id !== userId) {
            return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
          }
        }

        const result = await getUserStatus(db, userId);
        return Response.json(result, { headers: corsHeaders });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, {
          status: 400, headers: corsHeaders,
        });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
