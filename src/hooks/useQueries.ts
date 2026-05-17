// src/hooks/useQueries.ts
// CHANGED: useEpisodeDetails now resolves the stream URL via your Vercel proxy
// Everything else is identical to your original.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { AnimeWithStats, Episode, UserActivitySummary, UserWatchProgressDetailed } from '../types/database';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// Your Vercel deployment. Already deployed — just add the api/stream-proxy.js file.
const VERCEL_BASE = 'https://anime-hub-mocha.vercel.app';

// Build a proxied URL for any stream URL that needs header spoofing
export function buildProxiedStreamUrl(rawUrl: string): string {
  if (!rawUrl) return '';

  // Already a direct safe URL (Supabase storage) — no proxy needed
  if (rawUrl.includes('supabase.co/storage')) return rawUrl;

  // Direct mp4 without known CDN lock — try direct first
  if (rawUrl.match(/\.mp4(\?|$)/i) && !rawUrl.includes('megacloud')) return rawUrl;

  // Everything else (megacloud, rapidcloud, etc.) — proxy it
  return `${VERCEL_BASE}/api/stream-proxy?url=${encodeURIComponent(rawUrl)}`;
}

// ----------------------------------------------------------------------
// ANIME DISCOVERY QUERIES
// ----------------------------------------------------------------------

export function useTrendingAnime() {
  return useQuery({
    queryKey: ['anime', 'trending'],
    queryFn: async (): Promise<AnimeWithStats[]> => {
      const { data, error } = await supabase
        .from('anime_with_stats')
        .select('*')
        .order('total_watches', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });
}

export function useAnimeList(searchQuery?: string, genre?: string) {
  return useQuery({
    queryKey: ['anime', { search: searchQuery, genre }],
    queryFn: async (): Promise<AnimeWithStats[]> => {
      let query = supabase
        .from('anime_with_stats')
        .select('*')
        .order('rating', { ascending: false });
      if (searchQuery) query = query.ilike('title', `%${searchQuery}%`);
      if (genre) query = query.contains('genres', [genre]);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useAnimeDetails(animeId?: string) {
  return useQuery({
    queryKey: ['anime', animeId],
    queryFn: async (): Promise<AnimeWithStats | null> => {
      if (!animeId) return null;
      const { data, error } = await supabase
        .from('anime_with_stats')
        .select('*')
        .eq('id', animeId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!animeId,
  });
}

// ----------------------------------------------------------------------
// EPISODE QUERIES
// ----------------------------------------------------------------------

export function useEpisodes(animeId?: string) {
  return useQuery({
    queryKey: ['episodes', animeId],
    queryFn: async (): Promise<Episode[]> => {
      if (!animeId) return [];
      const { data, error } = await supabase
        .from('episodes')
        .select('*')
        .eq('anime_id', animeId)
        .order('episode_number', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!animeId,
  });
}

export function useEpisodeDetails(episodeId?: string) {
  return useQuery({
    queryKey: ['episode', episodeId],
    queryFn: async (): Promise<Episode | null> => {
      if (!episodeId) return null;
      const { data, error } = await supabase
        .from('episodes')
        .select('*')
        .eq('id', episodeId)
        .single();
      if (error) throw error;

      if (!data) return null;

      // ── KEY CHANGE: Rewrite video_url to go through the proxy ──────────────
      // The raw megacloud URL 403s without Referer headers.
      // Our Vercel proxy adds the correct headers transparently.
      // expo-video receives a normal URL and plays it fine.
      return {
        ...data,
        video_url: buildProxiedStreamUrl(data.video_url),
      };
    },
    enabled: !!episodeId,
  });
}

import { useAuth } from '../context/AuthContext';

// ----------------------------------------------------------------------
// USER QUERIES
// ----------------------------------------------------------------------

export function useUserHistory() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: ['user', userId, 'history'],
    queryFn: async (): Promise<UserWatchProgressDetailed[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('user_watch_progress_detailed')
        .select('*')
        .eq('user_id', userId)
        .order('last_watched', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export function useUserProfile() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: ['user', userId, 'profile'],
    queryFn: async (): Promise<UserActivitySummary | null> => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('user_activity_summary')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    },
    enabled: !!userId,
  });
}

// ----------------------------------------------------------------------
// WATCH PROGRESS & DISCOVERY
// ----------------------------------------------------------------------

export function useWatchProgress(episodeId?: string) {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: ['user', userId, 'progress', episodeId],
    queryFn: async () => {
      if (!userId || !episodeId) return null;
      const { data, error } = await supabase
        .from('user_watch_progress')
        .select('progress_seconds, is_completed')
        .eq('user_id', userId)
        .eq('episode_id', episodeId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    },
    enabled: !!userId && !!episodeId,
  });
}

export function useSimilarAnime(genres: string[] = [], currentAnimeId?: string, limit: number = 6) {
  return useQuery({
    queryKey: ['anime', 'similar', currentAnimeId, genres],
    queryFn: async (): Promise<AnimeWithStats[]> => {
      if (genres.length === 0) return [];
      const { data, error } = await supabase
        .from('anime_with_stats')
        .select('*')
        .overlaps('genres', genres)
        .neq('id', currentAnimeId || '')
        .order('rating', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
    enabled: genres.length > 0,
  });
}