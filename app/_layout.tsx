import { useEffect, useRef, Component, ReactNode } from 'react';
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
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

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

  // Don't hide the splash until fonts are ready — auth readiness is handled
  // inside AuthGuard (which has access to the AuthContext).
  useEffect(() => {
    if (loaded || error) {
      // Fonts ready — AuthGuard will release the splash once auth resolves too.
      // We do NOT call hideAsync() here; AuthGuard owns that responsibility.
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}

// ─── Error Boundary ───────────────────────────────────────────────────────────
// Catches uncaught render errors in any child and shows a recovery UI instead
// of a blank white screen or infinite splash.
interface EBState { hasError: boolean; message: string; }
class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): EBState {
    SplashScreen.hideAsync().catch(() => {});
    return { hasError: true, message: error?.message ?? 'Unknown error' };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={ebStyles.container}>
          <Text style={ebStyles.icon}>⚠️</Text>
          <Text style={ebStyles.title}>Something went wrong</Text>
          <Text style={ebStyles.msg} numberOfLines={4}>{this.state.message}</Text>
          <TouchableOpacity
            style={ebStyles.btn}
            onPress={() => this.setState({ hasError: false, message: '' })}
          >
            <Text style={ebStyles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const ebStyles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#08090D',
    alignItems: 'center', justifyContent: 'center',
    padding: 24, gap: 12,
  },
  icon: { fontSize: 48 },
  title: { fontSize: 20, fontWeight: '900', color: '#F8F9FD', textAlign: 'center' },
  msg: { fontSize: 12, color: '#9DA4B4', textAlign: 'center', lineHeight: 18 },
  btn: {
    marginTop: 8, paddingVertical: 12, paddingHorizontal: 32,
    backgroundColor: '#FF2B3C', borderRadius: 12,
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
});

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
 *
 * MFA check (getAuthenticatorAssuranceLevel) is intentionally separated
 * from the navigation effect: it fires only when the session changes, NOT
 * on every route change. This avoids a Supabase round-trip on every tab switch.
 */
function AuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { session, loading, isAuthReady } = useAuth();

  // Tracks whether MFA upgrade is required for the current session.
  // Populated once per session change; read on every navigation.
  const needsMfaRef = useRef(false);

  // Initialize push notification listeners & token database registration
  usePushNotifications();

  // Hide the splash screen only AFTER auth state is resolved.
  // This prevents the "logged-out flash" that occurs when fonts load fast
  // but the Supabase AsyncStorage session hydration hasn't finished yet.
  useEffect(() => {
    if (isAuthReady) {
      SplashScreen.hideAsync();
    }
  }, [isAuthReady]);

  // ── MFA level check ──────────────────────────────────────────────────────
  // Only runs when the session itself changes (sign-in / sign-out / token refresh).
  // Caches the result in needsMfaRef so the navigation effect below can read it
  // synchronously without triggering an extra Supabase call on every tab switch.
  useEffect(() => {
    if (!session) {
      needsMfaRef.current = false;
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!cancelled) {
        needsMfaRef.current =
          !error &&
          data != null &&
          data.nextLevel === 'aal2' &&
          data.currentLevel === 'aal1';
      }
    })();

    return () => { cancelled = true; };
  }, [session]); // ← session only, never pathname

  // Tracks whether user previously had an active session during this app lifecycle.
  const hadSessionRef = useRef(false);

  // ── Route protection ─────────────────────────────────────────────────────
  // Reads from needsMfaRef (no extra network call) on every navigation.
  useEffect(() => {
    if (!isAuthReady) return;

    if (!session) {
      const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p));
      // If user had an active session that was revoked/signed out remotely,
      // or if navigating to any protected route, redirect to login immediately.
      if (hadSessionRef.current || isProtected) {
        hadSessionRef.current = false;
        router.replace('/auth/login');
      }
    } else {
      hadSessionRef.current = true;
      if (needsMfaRef.current && pathname !== '/auth/mfa') {
        router.replace('/auth/mfa');
      }
    }
  }, [session, isAuthReady, pathname]);

  return (
    <Stack screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: '#080810' },
      animation: 'fade_from_bottom'
    }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="watch/[id]" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="downloads" options={{ headerShown: false }} />
      <Stack.Screen name="plans" options={{ presentation: 'card', headerShown: false }} />
      <Stack.Screen name="auth/login" options={{ presentation: 'modal' }} />
      <Stack.Screen name="auth/signup" options={{ presentation: 'modal' }} />
      <Stack.Screen name="auth/mfa" options={{ presentation: 'modal' }} />
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
    </Stack>
  );
}
