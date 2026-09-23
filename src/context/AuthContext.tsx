import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase, userAPI, User } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { getDeviceId } from '../lib/streamManager';
import {
  recordLocalSessionStart,
  clearLocalSessionStart,
  getLocalSessionStartTime,
  revokeOtherSessions,
} from '../lib/sessionManager';
import { getRandomAnimeAvatar } from '../constants/avatars';
import { Platform } from 'react-native';
import { extractOAuthParams } from '../lib/authUtils';
import { unregisterDevicePushToken } from '../lib/pushNotifications';

// Required for expo-web-browser to complete OAuth sessions on Android
WebBrowser.maybeCompleteAuthSession();

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAuthReady: boolean;  // true once the initial session check is complete
  hasPassword: boolean;  // true if account has password/email credentials set
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, username: string, avatarUrl?: string) => Promise<{ error: any; data?: any; needsEmailConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  logOutOtherSessions: () => Promise<{ error?: any }>;
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

  // ── Safety net: guarantee isAuthReady fires within 8 s ───────────────────
  // If the Supabase listener never calls back (no network on a cold first
  // install, corrupted AsyncStorage, etc.) this ensures the splash screen is
  // released and the user sees the app instead of a permanent black screen.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isInitializedRef.current) {
        isInitializedRef.current = true;
        setIsAuthReady(true);
        setLoading(false);
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // ── Single authoritative source of truth: onAuthStateChange ──────────────
    // Supabase fires INITIAL_SESSION synchronously from AsyncStorage on mount,
    // which is BEFORE any network call. Using both getSession() AND the listener
    // creates a race condition where both try to set state at the same time.
    // Using the listener alone avoids the flash: by the time the app renders,
    // the INITIAL_SESSION event has already fired with the cached session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        await clearLocalSessionStart();
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
        await clearLocalSessionStart();
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
        // Record login time if not already recorded
        const existingLoginTime = await getLocalSessionStartTime();
        if (!existingLoginTime) {
          await recordLocalSessionStart();
        }
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

  // ── Local & Server Sign Out ───────────────────────────────────────────────
  const signOut = useCallback(async () => {
    try {
      const currentUserId = user?.id || session?.user?.id;
      if (currentUserId) {
        await unregisterDevicePushToken(currentUserId).catch(() => {});
      }
    } catch {}
    await clearLocalSessionStart();
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, [user?.id, session?.user?.id]);

  // ── Realtime: listen for remote session revocation broadcast ───────────────
  // Instantly logs out other connected devices when "Log out other sessions" is invoked.
  useEffect(() => {
    if (!session?.user?.id) return;

    const uid = session.user.id;
    const topic = `user-auth-control:${uid}`;
    const channel = supabase
      .channel(topic, {
        config: { broadcast: { ack: true } },
      })
      .on('broadcast', { event: 'REVOKE_OTHER_SESSIONS' }, async (payload) => {
        const myDeviceId = await getDeviceId();
        const sourceDeviceId = payload?.sourceDeviceId ?? payload?.payload?.sourceDeviceId;
        if (sourceDeviceId && sourceDeviceId !== myDeviceId) {
          console.log('[Auth] Remote session revocation received for this device. Logging out.');
          await signOut();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, signOut]);

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
            avatar_url: metadata.avatar_url || getRandomAnimeAvatar().url,
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
        // Backfill anime avatar for existing accounts if avatar_url is missing
        if (!data.avatar_url) {
          const starterAvatar = getRandomAnimeAvatar().url;
          Promise.resolve(userAPI.updateProfile(userId, { avatar_url: starterAvatar })).catch(() => {});
          data.avatar_url = starterAvatar;
        }

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

        // Check if other sessions were revoked while this device was closed/offline
        try {
          const { data: prefs } = await userAPI.getPreferences(userId);
          const meta = (prefs?.subscription_meta as Record<string, unknown>) || {};
          if (meta.sessions_revoked_at && meta.revoked_by_device) {
            const revokedAt = new Date(meta.sessions_revoked_at as string).getTime();
            const myDeviceId = await getDeviceId();
            if (meta.revoked_by_device !== myDeviceId) {
              const loginTime = await getLocalSessionStartTime();
              if (loginTime > 0 && loginTime < revokedAt) {
                console.log('[Auth] Session was revoked while device was offline. Signing out.');
                await clearLocalSessionStart();
                await supabase.auth.signOut();
                setUser(null);
                setSession(null);
                return;
              }
            }
          }
        } catch {
          // Best effort check
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

  const signUp = useCallback(async (email: string, password: string, username: string, avatarUrl?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    // 1. Verify username availability beforehand
    const userCheck = await userAPI.checkUsernameAvailable(cleanUsername);
    if (!userCheck.available) {
      return { error: { message: userCheck.reason || 'Username is not available' } };
    }

    // Pick chosen avatar or assign a random starter anime character avatar
    const assignedAvatar = avatarUrl || getRandomAnimeAvatar().url;

    // 2. Register account via Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          username: cleanUsername,
          avatar_url: assignedAvatar,
        },
      },
    });

    if (error) {
      return { error };
    }

    // Handle anti-enumeration response: if email is already taken, identities is empty
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return {
        error: { message: 'An account with this email already exists. Please sign in.' },
      };
    }

    // Case A: Supabase auto-confirmed the user (data.session exists)
    if (data?.session && data?.user) {
      let insertError: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const { error: err } = await supabase.from('users').upsert({
          id: data.user.id,
          email: cleanEmail,
          username: cleanUsername,
          avatar_url: assignedAvatar,
          subscription_type: 'free',
          role: 'user',
          is_admin: false,
        });
        insertError = err;
        if (!err) break;
        await new Promise(r => setTimeout(r, attempt * 300));
      }

      if (insertError) {
        if (insertError.message?.includes('unique') || insertError.code === '23505') {
          return { error: { message: 'This username is already taken. Please choose another.' } };
        }
        console.warn('[Auth] Profile upsert warning:', insertError.message);
      }
      return { error: null, data, needsEmailConfirmation: false };
    }

    // Case B: Email confirmation required (data.session is null)
    // The username metadata is safely persisted in auth.users.
    // fetchUserProfile will auto-create the public.users record as soon as
    // the user clicks the email link and signs in with an authenticated session.
    return {
      error: null,
      data,
      needsEmailConfirmation: true,
    };
  }, []);

  const logOutOtherSessions = useCallback(async () => {
    if (!session?.user?.id) {
      return { error: new Error('User not authenticated') };
    }
    const res = await revokeOtherSessions(session.user.id);
    if (!res.success) {
      return { error: new Error(res.error || 'Failed to log out other devices') };
    }
    return { error: null };
  }, [session?.user?.id]);

  const refreshUser = useCallback(async () => {
    const { data: { session: freshSession } } = await supabase.auth.getSession();
    if (freshSession) {
      setSession(freshSession);
      if (freshSession.user) await fetchUserProfile(freshSession.user.id, freshSession.user);
    } else if (session?.user) {
      await fetchUserProfile(session.user.id, session.user);
    }
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

      // On Android, Custom Tabs may dismiss or return 'cancel' when the OS deep-links back into the app
      if (result.type !== 'success') {
        // Wait a brief tick to check if callback.tsx or the auth listener already completed sign-in
        await new Promise((r) => setTimeout(r, 600));
        const { data: { session: checkSession } } = await supabase.auth.getSession();
        if (checkSession) {
          return { error: null };
        }
        return { error: new Error('Google sign-in was cancelled') };
      }

      // If openAuthSessionAsync captured the return URL directly:
      const authParams = extractOAuthParams(result.url);

      // Support Implicit flow (#access_token= & refresh_token=)
      if (authParams.type === 'hash' && authParams.accessToken && authParams.refreshToken) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: authParams.accessToken,
          refresh_token: authParams.refreshToken,
        });
        return { error: setSessionError };
      }

      // Support PKCE flow (?code=)
      if (authParams.type === 'pkce' && authParams.code) {
        // If callback.tsx already exchanged it concurrently, skip
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession) return { error: null };

        // Pass the extracted PKCE code string, NOT the full URL
        const { error: sessionError } = await supabase.auth.exchangeCodeForSession(authParams.code);
        if (!sessionError || sessionError.message?.includes('verifier') || sessionError.message?.includes('both auth code')) {
          return { error: null };
        }
        return { error: sessionError };
      }

      // Double check if session exists anyway
      const { data: { session: finalSession } } = await supabase.auth.getSession();
      if (finalSession) return { error: null };

      return { error: null };
    } catch (e: any) {
      // Check if session became active despite error
      try {
        const { data: { session: fallbackSession } } = await supabase.auth.getSession();
        if (fallbackSession) return { error: null };
      } catch {}
      return { error: e };
    } finally {
      if (Platform.OS === 'android') {
        WebBrowser.dismissBrowser();
      }
    }
  }, []); // No session dep needed — does not read session state

  // Determine if the user has an email/password credential configured
  const hasPassword = Boolean(
    session?.user?.app_metadata?.providers?.includes('email') ||
    session?.user?.identities?.some((id: any) => id.provider === 'email')
  );

  const authValue = useMemo(() => ({
    session,
    user,
    loading,
    isAuthReady,
    hasPassword,
    signIn,
    signUp,
    signOut,
    logOutOtherSessions,
    refreshUser,
    signInWithGoogle,
    resetPassword,
  }), [
    session,
    user,
    loading,
    isAuthReady,
    hasPassword,
    signIn,
    signUp,
    signOut,
    logOutOtherSessions,
    refreshUser,
    signInWithGoogle,
    resetPassword,
  ]);

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export const useUserId = () => {
  const { user } = useContext(AuthContext);
  return user?.id;
};

export const useIsAuthenticated = () => {
  const { session } = useContext(AuthContext);
  return !!session;
};

export const useIsAuthReady = () => {
  const { isAuthReady } = useContext(AuthContext);
  return isAuthReady;
};
