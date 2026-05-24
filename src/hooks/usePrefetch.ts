/**
 * src/hooks/usePrefetch.ts
 *
 * Centralised prefetch helpers.
 * Call these on long-press / hover / viewport entry to warm TanStack Query cache
 * BEFORE the user actually navigates, so screens appear instant.
 *
 * Pattern:
 *   const { prefetchAnime } = usePrefetch();
 *   <AnimeCard onLongPress={() => prefetchAnime(anime.id)} ... />
 */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { fetchEpisodeById } from './useQueries';

// ─── Stale times must match what useQueries.ts uses ───────────────────────────
const STALE_ANIME   = 10 * 60 * 1000;
const STALE_EPISODE = 10 * 60 * 1000;

export function usePrefetch() {
  const queryClient = useQueryClient();

  /**
   * Warm the anime detail + episode list cache.
   * Call on AnimeCard long-press or when the card enters the viewport.
   * No-op if data is already fresh.
   */
  const prefetchAnime = useCallback(
    async (animeId: string) => {
      if (!animeId) return;

      // Fire both in parallel — Supabase handles the two connections concurrently
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: ['anime', animeId],
          staleTime: STALE_ANIME,
          queryFn: async () => {
            const { data, error } = await supabase
              .from('anime_with_stats')
              .select('*')
              .eq('id', animeId)
              .single();
            if (error) throw error;
            return data;
          },
        }),
        queryClient.prefetchQuery({
          queryKey: ['episodes', animeId],
          staleTime: STALE_ANIME,
          queryFn: async () => {
            const { data, error } = await supabase
              .from('episodes')
              .select('id, anime_id, episode_number, title, thumbnail_url, video_url, duration, is_premium, air_date')
              .eq('anime_id', animeId)
              .order('episode_number', { ascending: true });
            if (error) throw error;
            return data ?? [];
          },
        }),
      ]);
    },
    [queryClient],
  );

  /**
   * Warm a single episode in the cache.
   * Call when user hovers over an episode row.
   */
  const prefetchEpisode = useCallback(
    async (episodeId: string) => {
      if (!episodeId) return;
      await queryClient.prefetchQuery({
        queryKey: ['episode', episodeId],
        staleTime: STALE_EPISODE,
        queryFn: () => fetchEpisodeById(episodeId),
      });
    },
    [queryClient],
  );

  /**
   * Batch-warm a list of anime cards (e.g. trending row on home).
   * Uses Promise.allSettled so one failure doesn't block the rest.
   * Limits to the first `limit` items to avoid flooding the API.
   */
  const prefetchAnimeList = useCallback(
    async (animeIds: string[], limit = 5) => {
      const ids = animeIds.slice(0, limit);
      await Promise.allSettled(ids.map(id => prefetchAnime(id)));
    },
    [prefetchAnime],
  );

  return { prefetchAnime, prefetchEpisode, prefetchAnimeList };
}
