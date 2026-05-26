import React, { createContext, useContext, useEffect, useState } from 'react';
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

  useEffect(() => {
    // Safely load the initial session.
    // If the stored refresh token is invalid/expired, Supabase throws
    // AuthApiError: "Refresh Token Not Found". We catch that, sign out
    // cleanly (clears AsyncStorage), and treat the user as logged-out.
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        // Invalid / expired token — wipe it and start fresh
        console.warn('[Auth] Stale session detected, signing out:', error.message);
        supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }
      setSession(session);
      if (session?.user) fetchUserProfile(session.user.id, session.user);
      else setLoading(false);
    }).catch((err) => {
      // Network error or unexpected throw — treat same as invalid token
      console.warn('[Auth] getSession threw unexpectedly:', err);
      supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] onAuthStateChange event:', event, 'Has session:', !!session);
      // Fix: explicit parentheses to make operator precedence clear
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        // Token refresh failed or explicit sign-out — clear everything
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      setSession(session);
      if (session?.user) {
        console.log('[Auth] Fetching profile for user ID:', session.user.id);
        fetchUserProfile(session.user.id, session.user);
      }
      else { setUser(null); setLoading(false); }
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
          console.log('[Auth] Realtime user update received:', payload.new);
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
      console.log('[Auth] Syncing subscription cache to AsyncStorage for:', user.email);
      (async () => {
        try {
          const { data: prefs } = await (userAPI.getPreferences(user.id) as any);
          const meta = prefs?.subscription_meta as any;
          const cache = {
            subscription_type: user.subscription_type,
            next_renewal: meta?.next_renewal || null,
            last_verified: Date.now(),
          };
          await AsyncStorage.setItem('animehub:sub_cache', JSON.stringify(cache));
        } catch (err) {
          const cache = {
            subscription_type: user.subscription_type,
            next_renewal: null,
            last_verified: Date.now(),
          };
          await AsyncStorage.setItem('animehub:sub_cache', JSON.stringify(cache));
        }
      })();
    } else {
      AsyncStorage.removeItem('animehub:sub_cache');
    }
  }, [user]);

  async function fetchUserProfile(userId: string, authUser?: any) {
    try {
      console.log('[Auth] fetchUserProfile starting for:', userId);
      const { data, error } = await userAPI.getProfile(userId);
      console.log('[Auth] fetchUserProfile getProfile result:', !!data, 'Error:', error?.message);
      if (error || !data) {
        // Profile row missing (e.g. insert failed on signup, or first-time OAuth login)
        console.warn('[Auth] Profile row missing for user:', userId, error?.message || 'No data');
        
        // Auto-heal / auto-create profile if we have active user session metadata (e.g., for Google OAuth)
        const currentUser = authUser || session?.user;
        if (currentUser) {
          // Wait for JWT to propagate before attempting write, preventing RLS timing issues
          await new Promise(r => setTimeout(r, 500));
          
          console.log('[Auth] Auto-creating profile for:', currentUser.email);
          const metadata = currentUser.user_metadata || {};
          const rawName = metadata.full_name || metadata.name || '';
          const cleanName = rawName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          const emailPrefix = currentUser.email ? currentUser.email.split('@')[0] : '';
          const base = cleanName || emailPrefix || 'user';
          // Add short uid suffix to guarantee uniqueness
          const generatedUsername = `${base}_${userId.substring(0, 6)}`;
          
          const newProfile = {
            id: userId,
            email: currentUser.email || '',
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
            console.error('[Auth] Failed to auto-create user profile:', createError.message);
            setUser(null);
          } else {
            setUser(createdData);
          }
        } else {
          setUser(null);
        }
      } else {
        setUser(data);
      }
    } catch (e) {
      console.error('[Auth] fetchUserProfile threw:', e);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function signUp(email: string, password: string, username: string) {
    // Fix: Pass username in options.data so that Supabase database triggers expecting it don't crash
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
        console.warn(`[Auth] Profile insert attempt ${attempt} failed:`, err.message);
        await new Promise(r => setTimeout(r, attempt * 400)); // back-off: 400ms, 800ms
      }
      if (insertError) {
        // Auth user created but profile missing — surface this as an error
        console.error('[Auth] Could not create user profile after 3 attempts:', insertError);
        // Clean up the orphaned auth user so they can retry signup
        await supabase.auth.signOut();
        return { error: { message: 'Account created but profile setup failed. Please try again.' } };
      }
    }
    return { error };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }

  async function refreshUser() {
    if (session?.user) await fetchUserProfile(session.user.id, session.user);
  }

  async function resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'animehubmobile://reset-password',
    });
    return { error };
  }

  async function signInWithGoogle() {
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
      console.log('[Auth] WebBrowser.openAuthSessionAsync result:', result);
      if (result.type !== 'success') return { error: new Error('Google sign-in was cancelled') };

      // Support both PKCE (?code=) and Implicit (#access_token=) flows:
      if (result.url.includes('access_token=') && result.url.includes('refresh_token=')) {
        console.log('[Auth] Detected implicit flow tokens in redirect URL. Parsing...');
        const hash = result.url.split('#')[1];
        const urlParams = new URLSearchParams(hash);
        const accessToken = urlParams.get('access_token');
        const refreshToken = urlParams.get('refresh_token');
        
        if (accessToken && refreshToken) {
          console.log('[Auth] Setting session directly via implicit flow...');
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
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signUp, signOut, refreshUser, signInWithGoogle, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
