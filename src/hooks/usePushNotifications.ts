import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useUIStore } from '../store/uiStore';
import { haptic } from '../lib/haptics';
import {
  setupNotificationChannelsAsync,
  setupNotificationCategoriesAsync,
  registerForPushNotificationsAsync,
  unregisterDevicePushToken,
} from '../lib/pushNotifications';

export { unregisterDevicePushToken };

// Lifecycle initialization guards to prevent redundant native bridge IPC calls
let channelsInitialized = false;
let categoriesInitialized = false;

export function usePushNotifications() {
  const { user } = useAuth();
  const router = useRouter();
  const showToast = useUIStore((s) => s.showNotificationToast);

  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    // Setup Android channels & Action Categories once per app lifecycle
    if (!channelsInitialized) {
      channelsInitialized = true;
      setupNotificationChannelsAsync();
    }
    if (!categoriesInitialized) {
      categoriesInitialized = true;
      setupNotificationCategoriesAsync();
    }

    // Register device push token (for member or guest)
    registerForPushNotificationsAsync(user?.id ?? null).then((token) => {
      if (token && __DEV__) {
        console.log('[Push] Device registered successfully. Token:', token);
      }
    });

    // 1. Foreground listener: Displays custom in-app floating Dynamic Island toast
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      const content = notification.request.content;
      const data = content.data || {};

      if (__DEV__) {
        console.log('[Push] Foreground notification arrived:', content.title);
      }

      showToast({
        title: content.title || 'New Notification',
        message: content.body || '',
        posterUrl: (data.poster_url || data.image_url || data.thumbnail_url) as string | undefined,
        actionUrl: (data.action_url || (data.episode_id ? `/watch/${data.episode_id}` : undefined)) as string | undefined,
        type: (data.type || (data.action_url?.includes('plan') ? 'system' : undefined)) as string | undefined,
      });
    });

    // 2. Background/Lockscreen tap listener (Handles button clicks & tray taps)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const { actionIdentifier, notification } = response;
      const data = notification.request.content.data || {};
      const actionUrl = data.action_url;

      if (__DEV__) {
        console.log('[Push] Action clicked:', actionIdentifier, 'Data:', data);
      }

      // Handle lock screen action buttons:
      if (actionIdentifier === 'WATCH_NOW' || actionIdentifier === 'STREAM_FREE') {
        haptic.selection();
        const dest = actionUrl || (data.episode_id ? `/watch/${data.episode_id}` : '/');
        router.push(dest as any);
        return;
      }

      if (actionIdentifier === 'ADD_WATCHLIST') {
        const animeId = data.anime_id;
        if (user?.id && animeId) {
          try {
            await supabase.from('user_watchlist').upsert(
              { user_id: user.id, anime_id: animeId },
              { onConflict: 'user_id,anime_id' }
            );
            haptic.success();
            if (__DEV__) console.log('[Push] Added to watchlist in background for user:', user.id);
          } catch (e) {
            console.error('[Push] Failed background watchlist insert:', e);
          }
        }
        return;
      }

      if (actionIdentifier === 'VIEW_ANIME') {
        haptic.selection();
        const dest = data.anime_id ? `/anime/${data.anime_id}` : (actionUrl || '/(tabs)/explore');
        router.push(dest as any);
        return;
      }

      if (actionIdentifier === 'RENEW_NOW') {
        haptic.selection();
        router.push('/plans' as any);
        return;
      }

      // Default: User tapped the notification banner body itself
      if (typeof actionUrl === 'string' && actionUrl.startsWith('/')) {
        const SAFE_PREFIXES = ['/anime/', '/watch/', '/notifications', '/(tabs)', '/genre', '/studio', '/plans', '/manage-plan'];
        const isSafe = SAFE_PREFIXES.some((prefix) => actionUrl.startsWith(prefix));
        if (isSafe) {
          router.push(actionUrl as any);
        } else {
          console.warn('[Push] Blocked unsafe action URL:', actionUrl);
        }
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [user?.id]);
}
