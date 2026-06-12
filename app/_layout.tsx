import { useEffect } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { LocalizationProvider } from '../src/context/LocalizationContext';
import { supabase } from '../src/lib/supabase';
import CustomAlertModal from '../src/components/ui/CustomAlertModal';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { usePushNotifications } from '../src/hooks/usePushNotifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Singleton — must live outside the component so the cache is never wiped on re-renders
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 2 * 60 * 1000,   // 2-min global default (overridden per-query)
      gcTime: 5 * 60 * 1000,      // 5-min global default
    },
  },
});

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    'SpaceGrotesk': require('../assets/fonts/SpaceGrotesk-Bold.ttf'),
    'BeVietnamPro': require('../assets/fonts/BeVietnamPro-Medium.ttf'),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <LocalizationProvider>
              <StatusBar style="light" />
              <AuthGuard />
              <CustomAlertModal />
            </LocalizationProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Routes that require a logged-in user. Matches from the start of the path.
const PROTECTED_PREFIXES = [
  '/watchlist',
  '/history',
  '/favorites',
  '/stats',
  '/notifications',
  '/manage-plan',
  '/downloads',
  '/settings',
];

/**
 * Sits inside AuthProvider so it can read the auth state.
 * Redirects unauthenticated users to /auth/login when they
 * navigate to any protected route.
 */
function AuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { session, loading } = useAuth();

  // Initialize push notification listeners & token database registration
  usePushNotifications();

  useEffect(() => {
    // Wait for the initial session load before redirecting
    if (loading) return;
    if (!session) {
      const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p));
      if (isProtected) {
        router.replace('/auth/login');
      }
    } else {
      const checkAAL = async () => {
        const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (!error && data && data.nextLevel === 'aal2' && data.currentLevel === 'aal1') {
          if (pathname !== '/auth/mfa') {
            router.replace('/auth/mfa');
          }
        }
      };
      checkAAL();
    }
  }, [session, loading, pathname]);

  return (
    <Stack screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: '#080810' },
      animation: 'fade_from_bottom'
    }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="watch/[id]" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="downloads" options={{ headerShown: false }} />
      <Stack.Screen name="auth/login" options={{ presentation: 'modal' }} />
      <Stack.Screen name="auth/signup" options={{ presentation: 'modal' }} />
      <Stack.Screen name="auth/mfa" options={{ presentation: 'modal' }} />
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
    </Stack>
  );
}
