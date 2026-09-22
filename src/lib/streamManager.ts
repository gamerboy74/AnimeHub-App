/**
 * src/lib/streamManager.ts
 *
 * Concurrent Stream Enforcer (Simultaneous Device Limit)
 *
 * Policy:
 *   - Free users:    1 simultaneous stream
 *   - Premium users: 2 simultaneous streams
 *
 * Architecture:
 *   - Each device generates a persistent unique device_id in AsyncStorage.
 *   - While an episode is playing, a heartbeat is refreshed every 30 seconds.
 *   - Streams with last_heartbeat within the last 60 seconds are considered active.
 *   - If the active count exceeds the plan limit, playback is paused and the user
 *     is prompted to stop the other stream(s) or upgrade.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { supabase } from './supabase';

const DEVICE_ID_KEY = 'animehub:device_unique_id';
const HEARTBEAT_WINDOW_SECONDS = 60; // streams older than this are considered expired

let cachedDeviceId: string | null = null;

/**
 * Get or create a unique, persistent identifier for this physical device/installation.
 */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
      cachedDeviceId = existing;
      return existing;
    }
  } catch {
    // Non-blocking fallback
  }

  const generated = `dev_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  try {
    await AsyncStorage.setItem(DEVICE_ID_KEY, generated);
  } catch {
    // Best effort
  }
  cachedDeviceId = generated;
  return generated;
}

/**
 * Get a friendly name for this device (e.g., "Pixel 8", "iPhone 15 Pro", "Android Tablet").
 */
export function getDeviceName(): string {
  const model = Device.modelName || Device.deviceName;
  if (model) return model;
  return Platform.OS === 'ios' ? 'Apple Device' : 'Android Device';
}

export interface StreamAcquireResult {
  allowed: boolean;
  maxAllowed: number;
  activeCount: number;
  error?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanEpisodeId(id?: string): string | null {
  if (!id) return null;
  return UUID_REGEX.test(id) ? id : null;
}

/**
 * Check if current user is allowed to stream on this device, and register heartbeat.
 */
export async function acquireStreamSession(
  userId: string,
  subscriptionType: 'free' | 'premium',
  episodeId?: string,
): Promise<StreamAcquireResult> {
  const maxAllowed = subscriptionType === 'premium' ? 2 : 1;
  const deviceId = await getDeviceId();
  const deviceName = getDeviceName();
  const cutoffTime = new Date(Date.now() - HEARTBEAT_WINDOW_SECONDS * 1000).toISOString();

  try {
    // 1. Fetch currently active streams for this user
    const { data: activeStreams, error: queryError } = await supabase
      .from('user_active_streams')
      .select('device_id, device_name, last_heartbeat')
      .eq('user_id', userId)
      .gt('last_heartbeat', cutoffTime);

    if (queryError) {
      // If table doesn't exist yet or DB issue, fail open so user playback is never blocked
      console.warn('[streamManager] Could not query active streams (failing open):', queryError.message);
      return { allowed: true, maxAllowed, activeCount: 1 };
    }

    const activeList = activeStreams ?? [];
    // Count other devices currently streaming
    const otherActiveDevices = activeList.filter(s => s.device_id !== deviceId);

    // If other devices already meet or exceed the plan's limit, deny stream
    if (otherActiveDevices.length >= maxAllowed) {
      return {
        allowed: false,
        maxAllowed,
        activeCount: otherActiveDevices.length + 1,
      };
    }

    // 2. We're within limit — register / refresh this device's heartbeat
    const validEpId = cleanEpisodeId(episodeId);
    const { error: upsertErr } = await supabase.from('user_active_streams').upsert({
      user_id: userId,
      device_id: deviceId,
      device_name: deviceName,
      episode_id: validEpId,
      last_heartbeat: new Date().toISOString(),
    }, { onConflict: 'user_id,device_id' });

    if (upsertErr) {
      // If foreign key constraint failed on episode_id, fallback to null episode_id
      await supabase.from('user_active_streams').upsert({
        user_id: userId,
        device_id: deviceId,
        device_name: deviceName,
        episode_id: null,
        last_heartbeat: new Date().toISOString(),
      }, { onConflict: 'user_id,device_id' });
    }

    return {
      allowed: true,
      maxAllowed,
      activeCount: otherActiveDevices.length + 1,
    };
  } catch (err: any) {
    console.warn('[streamManager] acquireStreamSession error (failing open):', err?.message);
    return { allowed: true, maxAllowed, activeCount: 1 };
  }
}

/**
 * Periodic heartbeat sent while video is playing.
 * Re-validates stream concurrency and refreshes heartbeat.
 */
export async function sendStreamHeartbeat(
  userId: string,
  subscriptionTypeOrEpisodeId?: 'free' | 'premium' | string,
  episodeId?: string,
): Promise<StreamAcquireResult> {
  const subscriptionType: 'free' | 'premium' =
    subscriptionTypeOrEpisodeId === 'premium' ? 'premium' : 'free';
  const epId = subscriptionTypeOrEpisodeId !== 'free' && subscriptionTypeOrEpisodeId !== 'premium'
    ? subscriptionTypeOrEpisodeId
    : episodeId;

  return acquireStreamSession(userId, subscriptionType, epId);
}

/**
 * Release stream session when video pauses, ends, or user navigates away.
 */
export async function releaseStreamSession(userId: string): Promise<void> {
  try {
    const deviceId = await getDeviceId();
    await supabase
      .from('user_active_streams')
      .delete()
      .eq('user_id', userId)
      .eq('device_id', deviceId);
  } catch {
    // Best effort cleanup
  }
}

/**
 * Broadcast an instant STOP_OTHER_STREAMS event to all devices actively streaming for this user.
 */
export async function broadcastStopStreams(userId: string, sourceDeviceId: string): Promise<void> {
  try {
    const topic = `stream-control:${userId}`;
    const channels = supabase.getChannels();
    const existing = channels.find((ch) => ch.topic === `realtime:${topic}`);

    if (existing && existing.state === 'joined') {
      await existing.send({
        type: 'broadcast',
        event: 'STOP_OTHER_STREAMS',
        payload: {
          sourceDeviceId,
          timestamp: Date.now(),
        },
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
              event: 'STOP_OTHER_STREAMS',
              payload: {
                sourceDeviceId,
                timestamp: Date.now(),
              },
            });
          } catch (e) {
            console.warn('[streamManager] Error broadcasting stop signal:', e);
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
    console.warn('[streamManager] broadcastStopStreams failed (non-fatal):', err);
  }
}

/**
 * Remote disconnect: allows a user on their current phone to disconnect
 * other stale/unwanted streaming sessions on other devices instantly.
 */
export async function stopOtherStreams(userId: string): Promise<boolean> {
  try {
    const deviceId = await getDeviceId();

    // 1. Delete rows in Postgres
    const { error } = await supabase
      .from('user_active_streams')
      .delete()
      .eq('user_id', userId)
      .neq('device_id', deviceId);

    // 2. Broadcast instant stop event to all other playing clients via Realtime
    await broadcastStopStreams(userId, deviceId);

    return !error;
  } catch {
    return false;
  }
}
