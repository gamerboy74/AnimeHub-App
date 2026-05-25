// src/hooks/useQueries.ts
// Trending/top-rated/new-arrivals now fetch from Jikan (MAL) and cross-reference
// with the local DB by mal_id — same source as the "See All" screens.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { AnimeWithStats, Episode, UserActivitySummary, UserWatchProgressDetailed, Character, RelatedAnime } from '../types/database';
import { fetchJikanWithFallback } from '../lib/jikan';

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
    // Jikan trending doesn't change more than every ~15 min
    staleTime: 15 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: 2,
    queryFn: (): Promise<AnimeWithStats[]> => fetchJikanWithFallback('trending', 15),
  });
}

/**
 * Returns the first trending anime that has a banner_url.
 * Used specifically for the Hero Banner on the home screen.
 * Falls back to the first trending anime regardless of banner.
 */
export function useHeroAnime() {
  const { data: trending = [], ...rest } = useTrendingAnime();
  const hero = trending.find(a => !!a.banner_url) ?? trending[0] ?? null;
  return { data: hero, ...rest };
}

export function useTopRatedAnime(limit = 10) {
  return useQuery({
    queryKey: ['anime', 'top-rated', limit],
    staleTime: 15 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: 2,
    queryFn: (): Promise<AnimeWithStats[]> => fetchJikanWithFallback('top-rated', limit),
  });
}

export function useRecentAnime(limit = 10) {
  return useQuery({
    queryKey: ['anime', 'new-arrivals', limit],
    staleTime: 15 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: 2,
    queryFn: (): Promise<AnimeWithStats[]> => fetchJikanWithFallback('new-arrivals', limit),
  });
}


export function useAnimeList(searchQuery?: string, genre?: string) {
  return useQuery({
    queryKey: ['anime', { search: searchQuery, genre }],
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    queryFn: async (): Promise<AnimeWithStats[]> => {
      let query = supabase
        .from('anime_with_stats')
        .select('id, title, title_japanese, poster_url, banner_url, rating, year, status, type, genres, total_episodes, user_rating_avg, review_count, total_watches')
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
    retry: 1,
    queryFn: async (): Promise<AnimeWithStats[]> => {
      if (genres.length === 0) return [];
      const { data, error } = await supabase
        .from('anime_with_stats')
        .select('id, title, poster_url, banner_url, rating, year, type, genres, user_rating_avg, total_watches')
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

export function useAnimeCharacters(animeId?: string) {
  return useQuery({
    queryKey: ['anime-characters', animeId],
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    queryFn: async (): Promise<Character[]> => {
      if (!animeId) return [];
      const { data, error } = await supabase
        .from('anime_characters')
        .select('id, anime_id, name, image_url, role, voice_actor, name_japanese, name_romaji, description')
        .eq('anime_id', animeId);

      if (error) {
        if (error.code === '42P01') {
          console.warn('[useAnimeCharacters] anime_characters table does not exist yet');
          return [];
        }
        throw error;
      }
      return data || [];
    },
    enabled: !!animeId,
  });
}

const jikanRelationsCache = new Map<number, any[]>();

function normalizeRelationType(type: string): RelatedAnime['relation_type'] {
  const norm = (type || '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (norm === 'prequel') return 'prequel';
  if (norm === 'sequel') return 'sequel';
  if (norm === 'spin_off' || norm === 'spinoff') return 'spin_off';
  if (norm === 'alternative_version' || norm === 'alternative') return 'alternative_version';
  if (norm === 'summary') return 'summary';
  return 'other';
}

export function useAnimeRelations(animeId?: string) {
  return useQuery({
    queryKey: ['anime-relations', animeId],
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    queryFn: async (): Promise<RelatedAnime[]> => {
      if (!animeId) return [];

      // 0 & 1. Fetch current anime's MAL ID and local relations in parallel!
      const [currentAnimeRes, localRelationsRes] = await Promise.all([
        supabase
          .from('anime')
          .select('mal_id')
          .eq('id', animeId)
          .single(),
        supabase
          .from('anime_relations')
          .select('*')
          .eq('anime_id', animeId)
      ]);

      const currentMalId = currentAnimeRes.data?.mal_id;
      const localRelations = localRelationsRes.data || [];

      // 2. Dynamically fetch relations from Jikan API as fallback/enrichment (utilizing in-memory cache)
      let jikanRelations: any[] = [];
      if (currentMalId) {
        if (jikanRelationsCache.has(currentMalId)) {
          jikanRelations = jikanRelationsCache.get(currentMalId)!;
        } else {
          try {
            const res = await fetch(`https://api.jikan.moe/v4/anime/${currentMalId}/relations`);
            if (res.ok) {
              const json = await res.json();
              const jdata = json.data || [];
              for (const relGroup of jdata) {
                const relType = relGroup.relation; // e.g. "Sequel", "Prequel", "Other", etc.
                for (const entry of relGroup.entry) {
                  if (entry.type === 'anime') { // Only keep anime format relations
                    jikanRelations.push({
                      mal_id: entry.mal_id,
                      relation_type: relType,
                      title: entry.name,
                    });
                  }
                }
              }
              jikanRelationsCache.set(currentMalId, jikanRelations);
            }
          } catch (e) {
            console.warn(`[useAnimeRelations] Jikan relations fetch failed for malId ${currentMalId}:`, e);
          }
        }
      }

      // 3. Merge local and Jikan relations by mal_id, preferring local DB details if available
      const mergedMap = new Map<number, { mal_id: number; relation_type: string; title: string; poster_url?: string }>();

      // Add local relations first (applying format exclusions)
      for (const r of localRelations) {
        if (r.mal_id) {
          const type = (r.relation_type || '').toUpperCase();
          const format = (r.format || '').toUpperCase();
          if (type === 'ADAPTATION' || format === 'MANGA' || format === 'NOVEL') continue;

          mergedMap.set(r.mal_id, {
            mal_id: r.mal_id,
            relation_type: r.relation_type,
            title: r.title || '',
            poster_url: r.poster_url || undefined,
          });
        }
      }

      // Add Jikan relations if not already present
      for (const jr of jikanRelations) {
        const type = (jr.relation_type || '').toUpperCase();
        if (type === 'ADAPTATION') continue;

        if (!mergedMap.has(jr.mal_id)) {
          mergedMap.set(jr.mal_id, jr);
        }
      }

      const mergedRelations = Array.from(mergedMap.values());
      const malIds = mergedRelations.map(r => r.mal_id).filter(Boolean);

      // 4. Fetch actual matching anime locally using their MAL IDs
      let localAnimes: any[] = [];
      if (malIds.length > 0) {
        const { data: animes } = await supabase
          .from('anime')
          .select('id, mal_id, title, title_english, poster_url')
          .in('mal_id', malIds);
        localAnimes = animes || [];
      }

      // 5. Map the merged relations to the final structure
      const mapped = mergedRelations
        .map(r => {
          const localMatch = r.mal_id ? localAnimes.find(a => a.mal_id === r.mal_id) : null;
          
          if (!localMatch) return null; // Only show if we actually have the anime locally
          
          return {
            id: localMatch.id as string,
            title: localMatch.title_english || localMatch.title || r.title || 'Unknown Title',
            poster_url: localMatch.poster_url || r.poster_url || 'https://via.placeholder.com/110x160/1a1a2e/ffffff?text=No+Poster',
            relation_type: normalizeRelationType(r.relation_type),
          };
        })
        .filter(r => r !== null) as RelatedAnime[];

      // 6. Deduplicate by target anime ID to prevent React unique key warnings
      return Array.from(new Map(mapped.map(item => [item.id, item])).values());
    },
    enabled: !!animeId,
  });
}