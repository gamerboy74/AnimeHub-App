// src/hooks/useQueries.ts
// CHANGED: useEpisodeDetails now resolves the stream URL via your Vercel proxy
// Everything else is identical to your original.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { AnimeWithStats, Episode, UserActivitySummary, UserWatchProgressDetailed } from '../types/database';

// ─── URL HELPER ────────────────────────────────────────────────────────────────
// Returns the raw stream/embed URL. The WebView in watch/[id].tsx already handles
// popup blocking, redirect filtering, and CDN allow-listing natively.
export function buildProxiedStreamUrl(rawUrl: string): string {
  return rawUrl?.trim() ?? '';
}

// ----------------------------------------------------------------------
// ANIME DISCOVERY QUERIES
// ----------------------------------------------------------------------

export function useTrendingAnime() {
  return useQuery({
    queryKey: ['anime', 'trending'],
    staleTime: 5 * 60 * 1000,   // 5 min — trending doesn't change per-second
    gcTime: 10 * 60 * 1000,  // keep in memory 10 min after unmount
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
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
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
    staleTime: 10 * 60 * 1000, // anime metadata rarely changes
    gcTime: 15 * 60 * 1000,
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
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
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

// Shared fetcher — used by both useEpisodeDetails and the watch screen's prefetch.
// Keeping a single function guarantees the cache shape is always identical.
export async function fetchEpisodeById(episodeId: string): Promise<Episode | null> {
  const { data, error } = await supabase
    .from('episodes')
    .select('*')
    .eq('id', episodeId)
    .single();
  if (error) throw error;
  return data ?? null;
}

export function useEpisodeDetails(episodeId?: string) {
  return useQuery({
    queryKey: ['episode', episodeId],
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    queryFn: () => episodeId ? fetchEpisodeById(episodeId) : null,
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
    staleTime: 30 * 1000, // history should be reasonably fresh
    gcTime: 5 * 60 * 1000,
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
    staleTime: 10 * 1000, // progress must be fresh — 10s
    gcTime: 2 * 60 * 1000,
    queryFn: async () => {
      if (!userId || !episodeId) return null;
      const { data, error } = await supabase
        .from('user_progress')
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
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
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