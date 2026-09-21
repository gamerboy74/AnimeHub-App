import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase, userAPI, User } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

// Required for expo-web-browser to complete OAuth sessions on Android
WebBrowser.maybeCompleteAuthSession();

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAuthReady: boolean;  // true once the initial session check is complete
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // isAuthReady becomes true exactly once — after the very first session check.
  // Components should gate their auth-dependent renders on this flag, not `loading`,
  // to avoid the brief "logged-out" flash while AsyncStorage is being hydrated.
  const [isAuthReady, setIsAuthReady] = useState(false);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    // ── Single authoritative source of truth: onAuthStateChange ──────────────
    // Supabase fires INITIAL_SESSION synchronously from AsyncStorage on mount,
    // which is BEFORE any network call. Using both getSession() AND the listener
    // creates a race condition where both try to set state at the same time.
    // Using the listener alone avoids the flash: by the time the app renders,
    // the INITIAL_SESSION event has already fired with the cached session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        setSession(null);
        setUser(null);
        setLoading(false);
        if (!isInitializedRef.current) {
          isInitializedRef.current = true;
          setIsAuthReady(true);
        }
        return;
      }

      // Handle stale / invalid tokens gracefully
      if (event === 'INITIAL_SESSION' && session === null) {
        // No stored session — user is definitely logged out
        setSession(null);
        setUser(null);
        setLoading(false);
        if (!isInitializedRef.current) {
          isInitializedRef.current = true;
          setIsAuthReady(true);
        }
        return;
      }

      setSession(session);
      if (session?.user) {
        // fetchUserProfile sets isAuthReady inside its finally block.
        // We pass session.user directly to avoid the stale-closure on session state.
        await fetchUserProfile(session.user.id, session.user, event === 'INITIAL_SESSION');
      } else {
        setUser(null);
        setLoading(false);
        if (!isInitializedRef.current) {
          isInitializedRef.current = true;
          setIsAuthReady(true);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);


  // ── Realtime: watch users table for subscription_type changes ──────────────
  // When the user upgrades to premium (or is changed via Supabase dashboard),
  // the context user object updates instantly — no manual refresh needed.
  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel(`user-profile-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${session.user.id}`,
        },
        (payload) => {
          // Merge only the changed fields — don't replace the whole user object
          setUser(prev => prev ? { ...prev, ...(payload.new as Partial<User>) } : prev);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  // ── Sync user subscription cache to AsyncStorage for offline verification ──
  useEffect(() => {
    if (user) {
      const cache = {
        subscription_type: user.subscription_type,
        next_renewal: user.subscription_expires_at || null,
        last_verified: Date.now(),
      };
      AsyncStorage.setItem('animehub:sub_cache', JSON.stringify(cache)).catch(() => {});
    } else {
      AsyncStorage.removeItem('animehub:sub_cache');
    }
  }, [user?.id, user?.subscription_type, user?.subscription_expires_at]);

  // fetchUserProfile accepts the authUser argument directly to avoid closing over
  // the session state variable (which is a new object on every auth event).
  const fetchUserProfile = useCallback(async (userId: string, authUser?: any, isInitial = false) => {
    try {
      const { data, error } = await userAPI.getProfile(userId);
      if (error || !data) {
        // If it is a real network/transient error (not "row not found"), do NOT wipe user profile or log out
        if (error && error.code !== 'PGRST116') {
          return;
        }

        // Auto-heal / auto-create profile if we have active user session metadata (e.g., for Google OAuth)
        if (authUser) {
          // Wait for JWT to propagate before attempting write, preventing RLS timing issues
          await new Promise(r => setTimeout(r, 500));

          const metadata = authUser.user_metadata || {};
          const rawName = metadata.full_name || metadata.name || '';
          const cleanName = rawName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          const emailPrefix = authUser.email ? authUser.email.split('@')[0] : '';
          const base = cleanName || emailPrefix || 'user';
          // Add short uid suffix to guarantee uniqueness
          const generatedUsername = `${base}_${userId.substring(0, 6)}`;

          const newProfile = {
            id: userId,
            email: authUser.email || '',
            username: generatedUsername,
            avatar_url: metadata.avatar_url || null,
            subscription_type: 'free' as const,
            role: 'user',
            is_admin: false,
          };

          const { data: createdData, error: createError } = await supabase
            .from('users')
            .upsert(newProfile, { onConflict: 'id' })  // ← explicit conflict target
            .select()
            .maybeSingle();

          if (createError) {
            // Keep existing user if we have one
            setUser(prev => prev);
          } else {
            setUser(createdData);
          }
        } else {
          setUser(null);
        }
      } else {
        // Dynamic expiry check: if subscription expired, normalize immediately
        const isLapsed = Boolean(
          data.subscription_type === 'premium' &&
          data.billing_cycle !== 'admin_grant' &&
          data.subscription_expires_at &&
          new Date(data.subscription_expires_at).getTime() <= Date.now()
        );

        if (isLapsed) {
          // Immediately treat user as free locally without waiting for server write
          setUser({ ...data, subscription_type: 'free' });

          // Non-blocking notification to backend to run sweep with service role
          fetch(
            `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/subscription-manager`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'expire' }),
            }
          ).catch(() => {});
        } else {
          setUser(data);
        }
      }
    } catch {
      // Keep existing user if we have one — do not clear state on transient errors
    } finally {
      setLoading(false);
      // Mark auth as ready after the very first profile resolution
      if (isInitial && !isInitializedRef.current) {
        isInitializedRef.current = true;
        setIsAuthReady(true);
      }
    }
  }, []); // No deps — authUser is always passed as an argument; no stale closure risk

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string, username: string) => {
    // Pass username in options.data so that Supabase database triggers expecting it don't crash
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username,
        },
      },
    });
    if (!error && data.user) {
      // Retry the profile insert/upsert up to 3 times — network blips on signup are common
      let insertError: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const { error: err } = await supabase.from('users').upsert({
          id: data.user.id,
          email,
          username,
          subscription_type: 'free',
          role: 'user',
          is_admin: false,
        });
        insertError = err;
        if (!err) break;
        await new Promise(r => setTimeout(r, attempt * 400)); // back-off: 400ms, 800ms
      }
      if (insertError) {
        // Auth user created but profile missing — surface this as an error
        // Clean up the orphaned auth user so they can retry signup
        await supabase.auth.signOut();
        return { error: { message: 'Account created but profile setup failed. Please try again.' } };
      }
    }
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (session?.user) await fetchUserProfile(session.user.id, session.user);
  }, [session?.user, fetchUserProfile]);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'animehubmobile://reset-password',
    });
    return { error };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const redirectTo = Linking.createURL('auth/callback', { scheme: 'animehubmobile' });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (error || !data?.url) return { error: error ?? new Error('No OAuth URL returned') };

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') return { error: new Error('Google sign-in was cancelled') };

      // Support both PKCE (?code=) and Implicit (#access_token=) flows:
      if (result.url.includes('access_token=') && result.url.includes('refresh_token=')) {
        const hash = result.url.split('#')[1];
        const urlParams = new URLSearchParams(hash);
        const accessToken = urlParams.get('access_token');
        const refreshToken = urlParams.get('refresh_token');

        if (accessToken && refreshToken) {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          return { error: setSessionError };
        }
      }

      // On Android, callback.tsx handles the exchange via deep link.
      // Check if it already did — if so, skip to avoid consuming the verifier twice.
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (existingSession) return { error: null };

      // Supabase v2 uses PKCE — exchangeCodeForSession handles ?code= automatically
      const { error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url);
      if (sessionError?.message.includes('verifier')) {
        // Callback.tsx won the race — session is being set via onAuthStateChange
        return { error: null };
      }
      return { error: sessionError };
    } catch (e: any) {
      return { error: e };
    }
  }, []); // No session dep needed — does not read session state

  return (
    <AuthContext.Provider value={{ session, user, loading, isAuthReady, signIn, signUp, signOut, refreshUser, signInWithGoogle, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
