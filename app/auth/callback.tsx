/**
 * app/auth/callback.tsx
 *
 * Handles the OAuth deep-link redirect on Android when expo-web-browser
 * forwards the callback URL through Expo Router instead of returning it
 * directly to openAuthSessionAsync.
 *
 * URL pattern: animehubmobile://auth/callback?code=<pkce_code>
 */
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../../src/lib/supabase';
import { COLORS, SPACING } from '../../src/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; state?: string; error?: string; error_description?: string }>();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const incomingUrl = Linking.useURL();

  useEffect(() => {
    async function handleCallback() {
      // If Supabase sent back an error (e.g. user denied access)
      if (params.error) {
        setErrorMsg(params.error_description ?? params.error);
        setStatus('error');
        setTimeout(() => router.replace('/auth/login'), 3000);
        return;
      }

      const code = params.code;
      if (!code) {
        // No code — just redirect to login gracefully
        router.replace('/auth/login');
        return;
      }

      try {
        // Add a minor delay to allow any parallel/competing signInWithGoogle flow to complete and save its session
        await new Promise((resolve) => setTimeout(resolve, 350));

        // Prevent double exchange if session is already active (avoids code-reuse errors)
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          console.log('[AuthCallback] Session already active, redirecting to home.');
          router.replace('/(tabs)');
          return;
        }

        // Reconstruct the deep link URL with 'code' and 'state' so the Supabase client can match the PKCE verifier
        let exchangeUrl = incomingUrl;
        if (!exchangeUrl || !exchangeUrl.includes('code=')) {
          // Dynamic redirect URL that works in both Expo Go (exp://) and standalone app (animehubmobile://)
          const baseRedirect = Linking.createURL('auth/callback');
          exchangeUrl = `${baseRedirect}?code=${code}`;
          if (params.state) {
            exchangeUrl += `&state=${params.state}`;
          }
        }

        console.log('[AuthCallback] Exchanging PKCE code using URL:', exchangeUrl);
        const { error } = await supabase.auth.exchangeCodeForSession(exchangeUrl);
        if (error) {
          // If the error is about the verifier being empty, it almost certainly means
          // AuthContext.tsx's openAuthSessionAsync already consumed the code successfully!
          if (
            error.message.includes('verifier should be non empty') ||
            error.message.includes('code verifier should be non-empty') ||
            error.message.includes('both auth code') ||
            error.message.includes('verifier')
          ) {
            console.log('[AuthCallback] Code already exchanged by AuthContext, ignoring error.');
            router.replace('/(tabs)');
            return;
          }

          // Double check if a session was actually created anyway
          const { data: { session: activeSession } } = await supabase.auth.getSession();
          if (activeSession) {
            console.log('[AuthCallback] Exchange failed but active session found. Redirecting to home.');
            router.replace('/(tabs)');
          } else {
            setErrorMsg(error.message);
            setStatus('error');
            setTimeout(() => router.replace('/auth/login'), 3000);
          }
        } else {
          // onAuthStateChange in AuthContext will pick up the new session
          router.replace('/(tabs)');
        }
      } catch (e: any) {
        setErrorMsg(e.message ?? 'Unexpected error during sign-in');
        setStatus('error');
        setTimeout(() => router.replace('/auth/login'), 3000);
      }
    }

    handleCallback();
  }, [incomingUrl, params.code, params.state, params.error, params.error_description]);

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
