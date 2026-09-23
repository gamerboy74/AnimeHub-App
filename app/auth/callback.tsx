/**
 * app/auth/callback.tsx
 *
 * Handles the OAuth deep-link redirect on Android and iOS when the app
 * is opened via the custom scheme deep link:
 *
 * URL pattern: animehubmobile://auth/callback?code=<pkce_code>
 */
import { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../../src/lib/supabase';
import { extractOAuthParams } from '../../src/lib/authUtils';
import { COLORS, SPACING } from '../../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; state?: string; error?: string; error_description?: string }>();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const incomingUrl = Linking.useURL();
  const hasHandled = useRef(false);

  useEffect(() => {
    if (hasHandled.current) return;

    // Check if user is ALREADY signed in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        hasHandled.current = true;
        if (Platform.OS === 'android') WebBrowser.dismissBrowser();
        router.replace('/(tabs)');
      }
    });

    // Extract params from incoming URL or Expo Router search params
    const candidateUrl = incomingUrl || (params.code ? `animehubmobile://auth/callback?code=${params.code}&state=${params.state || ''}` : '');
    const authParams = extractOAuthParams(candidateUrl);

    const code = authParams.code || params.code;
    const error = authParams.error || params.error;
    const errorDesc = authParams.errorDescription || params.error_description;

    if (!code && !error && !authParams.accessToken) {
      return;
    }

    hasHandled.current = true;

    async function handleCallback() {
      if (Platform.OS === 'android') {
        WebBrowser.dismissBrowser();
      }

      if (error) {
        setErrorMsg(errorDesc || error);
        setStatus('error');
        setTimeout(() => router.replace('/auth/login'), 2500);
        return;
      }

      try {
        // Double-check active session before exchanging (prevents verifier race)
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession) {
          router.replace('/(tabs)');
          return;
        }

        // Implicit token flow (#access_token=)
        if (authParams.type === 'hash' && authParams.accessToken && authParams.refreshToken) {
          const { error: setErr } = await supabase.auth.setSession({
            access_token: authParams.accessToken,
            refresh_token: authParams.refreshToken,
          });
          if (setErr) throw setErr;
          router.replace('/(tabs)');
          return;
        }

        // PKCE code exchange (?code=)
        if (code) {
          console.log('[AuthCallback] Exchanging PKCE code for session...');
          // Pass the pure authorization code, NOT the full URL
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeErr) {
            console.log('[AuthCallback] Exchange note:', exchangeErr.message);
            // If code was already exchanged by AuthContext or verifier was removed:
            const { data: { session: activeSession } } = await supabase.auth.getSession();
            if (activeSession || exchangeErr.message.includes('verifier') || exchangeErr.message.includes('both auth code')) {
              router.replace('/(tabs)');
              return;
            }

            setErrorMsg(exchangeErr.message);
            setStatus('error');
            setTimeout(() => router.replace('/auth/login'), 3000);
            return;
          }
        }

        // Successfully exchanged
        router.replace('/(tabs)');
      } catch (e: any) {
        const { data: { session: fallbackSession } } = await supabase.auth.getSession();
        if (fallbackSession) {
          router.replace('/(tabs)');
        } else {
          setErrorMsg(e.message ?? 'Unexpected error during sign-in');
          setStatus('error');
          setTimeout(() => router.replace('/auth/login'), 3000);
        }
      }
    }

    handleCallback();
  }, [incomingUrl, params.code, params.state, params.error, params.error_description, router]);

  // Safety net: never spin longer than 4.5 seconds
  useEffect(() => {
    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/(tabs)');
      } else if (status === 'loading') {
        setStatus('error');
        setErrorMsg('Sign-in timed out. Please try again.');
        setTimeout(() => router.replace('/auth/login'), 2000);
      }
    }, 4500);
    return () => clearTimeout(timer);
  }, [status, router]);

  return (
    <View style={styles.container}>
      {status === 'loading' ? (
        <>
          <ActivityIndicator color={COLORS.neon} size="large" />
          <Text style={styles.text}>Signing you in…</Text>
        </>
      ) : (
        <>
          <Ionicons name="warning-outline" size={40} color={COLORS.danger} />
          <Text style={styles.errorText}>{errorMsg}</Text>
          <Text style={styles.subText}>Redirecting back to login…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    padding: SPACING.xl,
  },
  text: {
    color: COLORS.textMuted,
    fontSize: 16,
    fontWeight: '600',
    marginTop: SPACING.sm,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  subText: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
});
