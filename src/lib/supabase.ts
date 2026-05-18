import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://ieopfdxgjlmdsidikgbj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imllb3BmZHhnamxtZHNpZGlrZ2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1Mjg1MDgsImV4cCI6MjA3NjEwNDUwOH0.8MaTqu67m1EUnWQk1UUol2OHnFcP6k0vpcdI7EVX3aE';

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

export type Episode = {
  id: string;
  anime_id: string;
  episode_number: number;
  title?: string;
  description?: string;
  thumbnail_url?: string;
  video_url?: string;
  duration?: number;
  is_premium: boolean;
  air_date?: string;
};

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

// ─── API Helpers ──────────────────────────────────────────────

export const animeAPI = {
  getAll: (limit = 20, offset = 0) =>
    supabase.from('anime_with_stats').select('*').range(offset, offset + limit - 1),

  getById: (id: string) =>
    supabase.from('anime_with_stats').select('*').eq('id', id).single(),

  getByGenre: (genre: string, limit = 20) =>
    supabase.from('anime').select('*').contains('genres', [genre]).limit(limit),

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
};

export const episodeAPI = {
  getByAnime: (animeId: string) =>
    supabase.from('episodes').select('*').eq('anime_id', animeId).order('episode_number'),

  getById: (id: string) =>
    supabase.from('episodes').select('*').eq('id', id).single(),
};

export const userAPI = {
  getProfile: (userId: string) =>
    supabase.from('users').select('*').eq('id', userId).single(),

  updateProfile: (userId: string, data: Partial<User>) =>
    supabase.from('users').update(data).eq('id', userId),

  getFavorites: (userId: string) =>
    supabase.from('user_favorites').select('*, anime(*)').eq('user_id', userId),

  addFavorite: (userId: string, animeId: string) =>
    supabase.from('user_favorites').insert({ user_id: userId, anime_id: animeId }),

  removeFavorite: (userId: string, animeId: string) =>
    supabase.from('user_favorites').delete().eq('user_id', userId).eq('anime_id', animeId),

  getWatchlist: (userId: string) =>
    supabase.from('user_watchlist').select('*, anime(*)').eq('user_id', userId),

  addToWatchlist: (userId: string, animeId: string) =>
    supabase.from('user_watchlist').insert({ user_id: userId, anime_id: animeId }),

  removeFromWatchlist: (userId: string, animeId: string) =>
    supabase.from('user_watchlist').delete().eq('user_id', userId).eq('anime_id', animeId),

  getProgress: (userId: string) =>
    supabase.from('user_watch_progress_detailed').select('*').eq('user_id', userId).order('last_watched', { ascending: false }),

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

  getNotifications: (userId: string) =>
    supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }),

  markNotificationRead: (id: string) =>
    supabase.from('notifications').update({ read: true }).eq('id', id),

  getPreferences: (userId: string) =>
    supabase.from('user_preferences').select('*').eq('user_id', userId).single(),

  updatePreferences: (userId: string, data: any) =>
    supabase.from('user_preferences').upsert({ user_id: userId, ...data }),
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