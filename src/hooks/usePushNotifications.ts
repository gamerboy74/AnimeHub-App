import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// Set up how the OS should handle notifications that arrive when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  const { user } = useAuth();
  const router = useRouter();
  
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  // Register device and sync token to Supabase
  useEffect(() => {
    if (!user?.id) return;

    registerForPushNotificationsAsync(user.id).then(token => {
      if (token) {
        console.log('[Push] Device registered. Token:', token);
      }
    });

    // Listen for notifications that arrive when the app is in the foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('[Push] Notification received in foreground:', notification);
    });

    // Listen for taps on push notifications (handles lock screen and tray deep linking)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[Push] User tapped notification response:', response);
      
      const actionUrl = response.notification.request.content.data?.action_url;
      if (actionUrl) {
        console.log('[Push] Directing user to action URL:', actionUrl);
        // Deep link route using expo-router
        router.push(actionUrl as any);
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

async function registerForPushNotificationsAsync(userId: string): Promise<string | null> {
  let token: string | null = null;

  // 1. Android Specific Config: Set up notification channel (required for sound/banners on Android 8.0+)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#BF5FFF', // Electrict violet brand accent
    });
  }

  // 2. Physical Device Check: Push notifications do not work on standard iOS/Android simulators
  if (!Device.isDevice) {
    console.warn('[Push] Must use physical device for Push Notifications');
    return null;
  }

  // 3. Request Permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Push] Failed to get push token for push notification! Permissions rejected.');
    return null;
  }

  // 4. Retrieve Expo Push Token
  try {
    const projectId = 
      Constants.expoConfig?.extra?.eas?.projectId ?? 
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn('[Push] Project ID not found in app.json. Cannot generate push token.');
      return null;
    }

    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

    // 5. Sync the token with the Supabase database
    if (token) {
      const deviceModel = Device.modelName || 'Generic Mobile';
      const deviceOS = `${Platform.OS} ${Platform.Version}`;

      const { error } = await supabase
        .from('user_push_tokens')
        .upsert(
          {
            user_id: userId,
            token: token,
            device_name: `${deviceModel} (${deviceOS})`,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,token' }
        );

      if (error) {
        console.error('[Push] Failed to sync push token with database:', error.message);
      } else {
        console.log('[Push] Token successfully synced to database table public.user_push_tokens');
      }
    }
  } catch (error) {
    console.error('[Push] Error getting push token:', error);
  }

  return token;
}
