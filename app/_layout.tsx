import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '../src/context/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
            <StatusBar style="light" />
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
            </Stack>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
