import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const GUEST_DEVICE_KEY = 'animehub_guest_device_id';

// Configure foreground presentation
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Configure Android Notification Channels
 */
export async function setupNotificationChannelsAsync(): Promise<void> {
  if (Platform.OS !== 'android') return;

  // 1. Episode Releases (High Priority, Crimson LED, Vibration)
  await Notifications.setNotificationChannelAsync('episodes', {
    name: 'Episode Releases & Simulcasts',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF2B3C',
    showBadge: true,
    enableLights: true,
    enableVibrate: true,
  });

  // 2. Anime Announcements & News
  await Notifications.setNotificationChannelAsync('announcements', {
    name: 'New Anime & Announcements',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 100, 200],
    lightColor: '#00F5D4',
    showBadge: true,
  });

  // 3. VIP & Subscription Updates
  await Notifications.setNotificationChannelAsync('account', {
    name: 'VIP & Account Updates',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#FFD700',
    showBadge: false,
  });

  // 4. Default Fallback Channel
  await Notifications.setNotificationChannelAsync('default', {
    name: 'General Alerts',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF2B3C',
    showBadge: true,
  });
}

/**
 * Configure interactive notification action buttons
 */
export async function setupNotificationCategoriesAsync(): Promise<void> {
  try {
    // 1. New Episode Drops
    await Notifications.setNotificationCategoryAsync('EPISODE_DROP', [
      {
        identifier: 'WATCH_NOW',
        buttonTitle: '▶ Watch Now',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'ADD_WATCHLIST',
        buttonTitle: '➕ Watchlist',
        options: { opensAppToForeground: false },
      },
    ]);

    // 2. New Anime Added
    await Notifications.setNotificationCategoryAsync('ANIME_DROP', [
      {
        identifier: 'VIEW_ANIME',
        buttonTitle: '📺 View Anime',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'ADD_WATCHLIST',
        buttonTitle: '➕ Watchlist',
        options: { opensAppToForeground: false },
      },
    ]);

    // 3. Guest Drops
    await Notifications.setNotificationCategoryAsync('GUEST_DROP', [
      {
        identifier: 'STREAM_FREE',
        buttonTitle: '▶ Stream Free',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'EXPLORE',
        buttonTitle: '🔥 Explore App',
        options: { opensAppToForeground: true },
      },
    ]);

    // 4. VIP Subscription Reminders
    await Notifications.setNotificationCategoryAsync('RENEWAL_ALERT', [
      {
        identifier: 'RENEW_NOW',
        buttonTitle: '⭐ Renew Plan',
        options: { opensAppToForeground: true },
      },
    ]);
  } catch (err) {
    if (__DEV__) {
      console.warn('[Push] Failed registering notification categories:', err);
    }
  }
}

let lastSyncedUserId: string | null | undefined = undefined;
let lastSyncedToken: string | null = null;

/**
 * Registers device for push notifications and syncs with Supabase.
 * Supports both authenticated users and anonymous guest devices.
 */
export async function registerForPushNotificationsAsync(userId: string | null): Promise<string | null> {
  let token: string | null = null;

  if (!Device.isDevice) {
    if (__DEV__) {
      console.log('[Push] Physical device check: Running on simulator. Push token skipped.');
    }
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    if (__DEV__) console.warn('[Push] Permission not granted for push notifications.');
    return null;
  }

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn('[Push] Project ID not found in app.json. Cannot generate push token.');
      return null;
    }

    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

    if (token) {
      if (lastSyncedUserId === userId && lastSyncedToken === token) {
        return token;
      }
      lastSyncedUserId = userId;
      lastSyncedToken = token;

      const deviceModel = Device.modelName || 'Generic Mobile';
      const deviceOS = `${Platform.OS} ${Platform.Version}`;
      const deviceName = `${deviceModel} (${deviceOS})`;

      let guestId: string | null = null;
      if (!userId) {
        guestId = await AsyncStorage.getItem(GUEST_DEVICE_KEY);
        if (!guestId) {
          guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          await AsyncStorage.setItem(GUEST_DEVICE_KEY, guestId);
        }
      }

      // 1. Try atomic RPC first
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('register_device_push_token', {
          p_token: token,
          p_device_name: deviceName,
          p_is_guest: !userId,
          p_guest_device_id: guestId,
        });

        if (!rpcError && rpcData?.success) {
          if (__DEV__) console.log('[Push] Token registered via RPC:', rpcData);
          return token;
        }
      } catch {
        // Fallback to table queries below if RPC is not deployed yet
      }

      // 2. Resilient table fallback
      const now = new Date().toISOString();
      if (userId) {
        await supabase.from('user_push_tokens').delete().eq('token', token).is('user_id', null);

        const { error } = await supabase
          .from('user_push_tokens')
          .upsert(
            {
              user_id: userId,
              token: token,
              device_name: deviceName,
              is_guest: false,
              guest_device_id: null,
              updated_at: now,
            },
            { onConflict: 'user_id,token' }
          );

        if (error && __DEV__) {
          console.warn('[Push] Failed syncing member token:', error.message);
        }
      } else {
        await supabase.from('user_push_tokens').delete().eq('token', token).is('user_id', null);

        const { error } = await supabase
          .from('user_push_tokens')
          .insert({
            token: token,
            device_name: deviceName,
            is_guest: true,
            guest_device_id: guestId,
            updated_at: now,
          });

        if (error && __DEV__) {
          console.warn('[Push] Failed registering guest token:', error.message);
        }
      }
    }
  } catch (error) {
    console.error('[Push] Error registering push token:', error);
  }

  return token;
}

/**
 * Remove device push token associated with user upon sign out
 */
export async function unregisterDevicePushToken(userId: string): Promise<void> {
  try {
    if (!lastSyncedToken) {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;
      if (projectId) {
        lastSyncedToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      }
    }

    if (lastSyncedToken && userId) {
      await supabase
        .from('user_push_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('token', lastSyncedToken);
      lastSyncedUserId = undefined;
      lastSyncedToken = null;
    }
  } catch (e) {
    console.warn('[Push] Error unregistering token on signout:', e);
  }
}
