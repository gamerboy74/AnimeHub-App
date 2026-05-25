import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, userAPI, User } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
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
      if (session?.user) fetchUserProfile(session.user.id);
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
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' && !session) {
        // Token refresh failed or explicit sign-out — clear everything
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      setSession(session);
      if (session?.user) fetchUserProfile(session.user.id);
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

  async function fetchUserProfile(userId: string) {
    try {
      const { data } = await userAPI.getProfile(userId);
      setUser(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function signUp(email: string, password: string, username: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (!error && data.user) {
      try {
        await supabase.from('users').insert({
          id: data.user.id,
          email,
          username,
          subscription_type: 'free',
          role: 'user',
          is_admin: false,
        });
      } catch (insertError) {
        console.error('Error inserting user profile:', insertError);
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
    if (session?.user) await fetchUserProfile(session.user.id);
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signUp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
