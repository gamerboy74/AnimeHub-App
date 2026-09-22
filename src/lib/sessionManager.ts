/**
 * src/lib/sessionManager.ts
 *
 * Multi-Device Session Management & Instant Revocation
 *
 * Solves:
 * 1. Supabase JS client's signOut({ scope: 'others' }) bug where the calling device's
 *    local session is wiped due to client SDK internal state reset.
 * 2. Supabase JWT statelessness: other active devices do not get automatically notified
 *    by GoTrue when their refresh token is revoked.
 *
 * Solution Architecture:
 * - Direct HTTP call to GoTrue /auth/v1/logout?scope=others to revoke server-side refresh
 *   tokens WITHOUT touching the current client's local AsyncStorage session.
 * - Realtime WebSocket broadcast on channel `user-auth-control:${userId}` with
 *   `REVOKE_OTHER_SESSIONS`, triggering an instant (<100ms) client-side signOut on all
 *   other active devices while leaving the current device authenticated.
 * - Persistent `sessions_revoked_at` timestamp in user_preferences for offline devices
 *   to immediately sign out upon app launch or resume.
 * - Automatic stream revocation on other devices via stopOtherStreams().
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, userAPI } from './supabase';
import { getDeviceId, getDeviceName, stopOtherStreams } from './streamManager';

const SESSION_LOGIN_TIME_KEY = 'animehub:session_login_time';

/**
 * Record the timestamp when the current session was created or hydrated locally.
 */
export async function recordLocalSessionStart(): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSION_LOGIN_TIME_KEY, Date.now().toString());
  } catch {
    // Non-blocking
  }
}

/**
 * Clear the local session start timestamp on logout.
 */
export async function clearLocalSessionStart(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_LOGIN_TIME_KEY);
  } catch {
    // Non-blocking
  }
}

/**
 * Get the local session start timestamp in milliseconds.
 */
export async function getLocalSessionStartTime(): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(SESSION_LOGIN_TIME_KEY);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Broadcast an auth control event across all connected devices for this user.
 */
export async function broadcastAuthEvent(
  userId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const topic = `user-auth-control:${userId}`;
    const channels = supabase.getChannels();
    const existing = channels.find((ch) => ch.topic === `realtime:${topic}`);

    if (existing && existing.state === 'joined') {
      await existing.send({
        type: 'broadcast',
        event,
        payload,
      });
      return;
    }

    const tempChannel = supabase.channel(topic, {
      config: { broadcast: { ack: true } },
    });

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        supabase.removeChannel(tempChannel);
        resolve();
      }, 3000);

      tempChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            await tempChannel.send({
              type: 'broadcast',
              event,
              payload,
            });
          } catch (e) {
            console.warn('[sessionManager] Broadcast error:', e);
          } finally {
            clearTimeout(timeout);
            setTimeout(() => {
              supabase.removeChannel(tempChannel);
              resolve();
            }, 250);
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          supabase.removeChannel(tempChannel);
          resolve();
        }
      });
    });
  } catch (err) {
    console.warn('[sessionManager] broadcastAuthEvent failed (non-fatal):', err);
  }
}

/**
 * Revoke all OTHER sessions for this user while keeping the current device active:
 * 1. Invalidate other refresh tokens on GoTrue server via direct fetch (bypassing client signOut).
 * 2. Broadcast REVOKE_OTHER_SESSIONS to instantly log out other active devices via Realtime.
 * 3. Store sessions_revoked_at timestamp in user_preferences for offline device catch-up.
 * 4. Stop all active streams on other devices.
 * 5. Clean up other push tokens from user_push_tokens.
 */
export async function revokeOtherSessions(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const currentDeviceId = await getDeviceId();
    const { data: { session } } = await supabase.auth.getSession();

    // 1. Invalidate other refresh tokens on GoTrue server directly
    if (session?.access_token) {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseAnonKey) {
        try {
          const res = await fetch(`${supabaseUrl}/auth/v1/logout?scope=others`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${session.access_token}`,
            },
          });
          if (!res.ok) {
            console.warn('[sessionManager] GoTrue server logout status:', res.status);
          }
        } catch (e: any) {
          console.warn('[sessionManager] GoTrue server logout others failed (non-fatal):', e?.message);
        }
      }
    }

    // 2. Broadcast instant revocation to other online devices via Realtime
    await broadcastAuthEvent(userId, 'REVOKE_OTHER_SESSIONS', {
      sourceDeviceId: currentDeviceId,
      timestamp: Date.now(),
    });

    // 3. Record revocation timestamp in user_preferences for offline device validation
    try {
      const nowIso = new Date().toISOString();
      const { data: currentPrefs } = await userAPI.getPreferences(userId);
      const currentMeta = (currentPrefs?.subscription_meta as Record<string, unknown>) || {};
      await userAPI.updateSubscriptionMeta(userId, {
        ...currentMeta,
        sessions_revoked_at: nowIso,
        revoked_by_device: currentDeviceId,
      });
    } catch (e: any) {
      console.warn('[sessionManager] Failed to record revocation meta (non-fatal):', e?.message);
    }

    // 4. Terminate any active streams on other devices
    await stopOtherStreams(userId);

    // 5. Clean up push tokens for other devices in user_push_tokens
    try {
      const currentDeviceName = getDeviceName();
      await supabase
        .from('user_push_tokens')
        .delete()
        .eq('user_id', userId)
        .neq('device_name', currentDeviceName);
    } catch {
      // Best-effort cleanup
    }

    return { success: true };
  } catch (err: any) {
    console.error('[sessionManager] revokeOtherSessions error:', err);
    return { success: false, error: err?.message || 'Failed to revoke other sessions' };
  }
}
