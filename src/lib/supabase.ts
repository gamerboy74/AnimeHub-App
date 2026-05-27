import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase env vars. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env file.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ─── Types from DB ───────────────────────────────────────────
export type Anime = {
  id: string;
  title: string;
  title_japanese?: string;
  title_english?: string;
  title_romaji?: string;
  description?: string;
  poster_url?: string;
  banner_url?: string;
  trailer_url?: string;
  rating?: number;
  year?: number;
  status?: string;
  type?: string;
  genres?: string[];
  studios?: string[];
  total_episodes?: number;
  duration?: number;
  age_rating?: string;
  mal_id?: number;
  created_at?: string;
};

export type AnimeWithStats = Anime & {
  actual_episode_count?: number;
  free_episode_count?: number;
  premium_episode_count?: number;
  favorite_count?: number;
  watchlist_count?: number;
  total_watches?: number;
  review_count?: number;
  user_rating_avg?: number;
};

// Episode is defined (and owned) in src/types/database.ts — re-exported here for convenience
export type { Episode, Character, RelatedAnime } from '../types/database';

export type UserProgress = {
  id: string;
  user_id: string;
  episode_id: string;
  progress_seconds: number;
  is_completed: boolean;
  last_watched: string;
};

export type Review = {
  id: string;
  user_id: string;
  anime_id: string;
  rating?: number;
  review_text?: string;
  is_spoiler: boolean;
  created_at: string;
};

export type User = {
  id: string;
  email: string;
  username: string;
  bio?: string;
  avatar_url?: string;
  subscription_type: 'free' | 'premium';
  role: string;
  is_admin: boolean;
  total_watch_time: number;
  anime_watched: number;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  read: boolean;
  action_url?: string;
  created_at: string;
};

export type SubscriptionPlan = {
  id: string;
  name: string;            // 'free' | 'premium_monthly' | 'premium_yearly'
  display_name: string;    // 'Monthly' | 'Yearly'
  tier: 'free' | 'premium';
  price_paise: number;     // 0 for free, 14900 for ₹149
  currency: string;
  billing_cycle: 'monthly' | 'yearly' | null;
  badge: string | null;    // 'BEST VALUE' | null
  savings_text: string | null;
  sort_order: number;
};

export type PlanFeature = {
  id: string;
  label: string;
  sub_label: string | null;
  free_value: string;      // '✓' | '✗' | descriptive text
  premium_value: string;
  is_highlighted: boolean;
  sort_order: number;
};

// ─── API Helpers ──────────────────────────────────────────────

// In-memory cache to prevent redundant database queries for static mapping
let malIdMapCache: Map<number, string> | null = null;

export const plansAPI = {
  /** Fetch all active plans + feature rows in one round trip.
   *  Returns sorted arrays ready to render — no transforms needed in UI. */
  getAll: async (): Promise<{ plans: SubscriptionPlan[]; features: PlanFeature[] }> => {
    const [plansRes, featuresRes] = await Promise.all([
      supabase
        .from('subscription_plans')
        .select('id,name,display_name,tier,price_paise,currency,billing_cycle,badge,savings_text,sort_order')
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('plan_features')
        .select('id,label,sub_label,free_value,premium_value,is_highlighted,sort_order')
        .eq('is_active', true)
        .order('sort_order'),
    ]);
    return {
      plans:    (plansRes.data    ?? []) as SubscriptionPlan[],
      features: (featuresRes.data ?? []) as PlanFeature[],
    };
  },
};

export const animeAPI = {
  getAll: (limit = 20, offset = 0) =>
    supabase.from('anime_with_stats').select('*').range(offset, offset + limit - 1),

  getById: (id: string) =>
    supabase.from('anime_with_stats').select('*').eq('id', id).single(),

  getByGenre: (genre: string, limit = 20) =>
    supabase.from('anime').select('*').contains('genres', [genre]).limit(limit),

  getByStudio: (studio: string, limit = 20) =>
    supabase.from('anime').select('*').contains('studios', [studio]).limit(limit),


  search: (query: string) =>
    supabase.from('anime').select('*')
      .or(`title.ilike.%${query}%,title_english.ilike.%${query}%,title_romaji.ilike.%${query}%`)
      .limit(30),

  getTrending: (limit = 10) =>
    supabase.from('anime_with_stats').select('*').order('total_watches', { ascending: false }).limit(limit),

  getTopRated: (limit = 10) =>
    supabase.from('anime_with_stats').select('*').order('user_rating_avg', { ascending: false }).limit(limit),

  getRecent: (limit = 10) =>
    supabase.from('anime').select('*').order('created_at', { ascending: false }).limit(limit),

  /** Returns the Set of all mal_ids present in the local database */
  getMalIds: async (): Promise<Set<number>> => {
    const map = await animeAPI.getMalIdMap();
    return new Set(map.keys());
  },

  /** Returns a Map<mal_id, supabase_uuid> for navigation from external APIs */
  getMalIdMap: async (): Promise<Map<number, string>> => {
    if (malIdMapCache) {
      return malIdMapCache;
    }
    const { data } = await supabase
      .from('anime')
      .select('id, mal_id')
      .not('mal_id', 'is', null);
    const map = new Map<number, string>();
    (data ?? []).forEach((r: { id: string; mal_id: number }) => map.set(r.mal_id, r.id));
    malIdMapCache = map;
    return map;
  },

  /** Invalidates the local cache if new entries are dynamically inserted/refreshed */
  invalidateCache: () => {
    malIdMapCache = null;
  },
};

export const episodeAPI = {
  getByAnime: (animeId: string) =>
    supabase.from('episodes').select('*').eq('anime_id', animeId).order('episode_number'),

  getById: (id: string) =>
    supabase.from('episodes').select('*').eq('id', id).single(),
};

export const userAPI = {
  getProfile: (userId: string) =>
    supabase.from('users').select('*').eq('id', userId).maybeSingle(),

  updateProfile: (userId: string, data: Partial<User>) =>
    supabase.from('users').update(data).eq('id', userId).select(),

  uploadAvatar: async (userId: string, localUri: string): Promise<string> => {
    const response = await fetch(localUri);
    const blob = await response.blob();
    const fileExt = localUri.split('.').pop() || 'jpg';
    const fileName = `${userId}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from('user-avatars')
      .upload(fileName, blob, {
        contentType: `image/${fileExt}`,
        upsert: true,
      });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('user-avatars').getPublicUrl(fileName);
    return data.publicUrl;
  },

  getFavorites: (userId: string) =>
    supabase.from('user_favorites').select('*, anime(*)').eq('user_id', userId),

  addFavorite: (userId: string, animeId: string) =>
    supabase.from('user_favorites').insert({ user_id: userId, anime_id: animeId }),

  removeFavorite: (userId: string, animeId: string) =>
    supabase.from('user_favorites').delete().eq('user_id', userId).eq('anime_id', animeId),

  getWatchlist: (userId: string) =>
    supabase.from('user_watchlist').select('*, anime(*)').eq('user_id', userId),

  getWatchlistLight: (userId: string) =>
    supabase.from('user_watchlist').select('id').eq('user_id', userId),

  addToWatchlist: (userId: string, animeId: string) =>
    supabase.from('user_watchlist').insert({ user_id: userId, anime_id: animeId }),

  removeFromWatchlist: (userId: string, animeId: string) =>
    supabase.from('user_watchlist').delete().eq('user_id', userId).eq('anime_id', animeId),

  getProgress: (userId: string) =>
    supabase.from('user_watch_progress_detailed').select('*').eq('user_id', userId).order('last_watched', { ascending: false }),

  getProgressLight: (userId: string) =>
    supabase.from('user_watch_progress_detailed')
      .select('anime_id, last_watched, progress_seconds, is_completed, genres')
      .eq('user_id', userId)
      .order('last_watched', { ascending: false }),

  // Returns the most recently watched episode for a specific anime (for "Continue Watching")
  getAnimeProgress: (userId: string, animeId: string) =>
    supabase
      .from('user_progress')
      .select('episode_id, progress_seconds, is_completed, last_watched, episodes!inner(anime_id, episode_number)')
      .eq('user_id', userId)
      .eq('episodes.anime_id', animeId)
      .order('last_watched', { ascending: false })
      .limit(1)
      .maybeSingle(),

  upsertProgress: (userId: string, episodeId: string, progressSeconds: number, isCompleted: boolean) =>
    supabase.from('user_progress').upsert({
      user_id: userId,
      episode_id: episodeId,
      progress_seconds: progressSeconds,
      is_completed: isCompleted,
      last_watched: new Date().toISOString(),
    }, { onConflict: 'user_id,episode_id' }),

  clearOtherProgress: (userId: string, episodeIds: string[]) =>
    supabase.from('user_progress').delete().eq('user_id', userId).in('episode_id', episodeIds),

  getUserStats: (userId: string) =>
    supabase.from('user_stats').select('*').eq('user_id', userId).maybeSingle(),

  getUserBadges: (userId: string) =>
    supabase.from('user_badges').select('badge_code').eq('user_id', userId),

  getNotifications: (userId: string) =>
    supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }),

  markNotificationRead: (id: string) =>
    supabase.from('notifications').update({ read: true }).eq('id', id),

  markAllNotificationsRead: (userId: string) =>
    supabase.from('notifications').update({ read: true }).eq('user_id', userId),

  clearAllNotifications: (userId: string) =>
    supabase.from('notifications').delete().eq('user_id', userId),

  deleteNotification: (id: string) =>
    supabase.from('notifications').delete().eq('id', id),

  getPreferences: (userId: string) =>
    // maybeSingle() returns null (not error) when no preferences row exists yet
    supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle(),

  updatePreferences: (userId: string, data: any) =>
    supabase.from('user_preferences').upsert({ user_id: userId, ...data }),

  /** Safely update ONLY subscription_meta — never touches other pref columns.
   *  Use this instead of updatePreferences when writing billing data,
   *  so a settings toggle can never accidentally wipe the subscription_meta field. */
  updateSubscriptionMeta: (userId: string, meta: any) =>
    supabase
      .from('user_preferences')
      .upsert(
        { user_id: userId, subscription_meta: meta },
        { onConflict: 'user_id', ignoreDuplicates: false },
      ),
};

export const reviewAPI = {
  getByAnime: (animeId: string) =>
    supabase.from('reviews').select('*, users(username, avatar_url)').eq('anime_id', animeId).order('created_at', { ascending: false }),

  upsert: (userId: string, animeId: string, rating: number, text: string, isSpoiler: boolean) =>
    supabase.from('reviews').upsert({
      user_id: userId,
      anime_id: animeId,
      rating,
      review_text: text,
      is_spoiler: isSpoiler,
    }),

  delete: (id: string) =>
    supabase.from('reviews').delete().eq('id', id),
};