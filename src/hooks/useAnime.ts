/**
 * useAnime.ts — LEGACY re-exports for backward compatibility.
 *
 * These hooks previously maintained their own Supabase queries.
 * They have been consolidated into src/hooks/useQueries.ts which uses
 * TanStack Query with proper cache keys and stale times.
 *
 * All callers should migrate to useQueries.ts directly, but these
 * re-exports ensure nothing breaks in the meantime.
 *
 * IMPORTANT: useTrendingAnime here previously queried the `anime` table
 * and ordered by `score`. The canonical version in useQueries.ts queries
 * `anime_with_stats` and orders by `total_watches`. Both share the same
 * query key ['anime', 'trending'] so they share the same cache slot.
 */
export {
  useTrendingAnime,
  useAnimeDetails,
} from './useQueries';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/**
 * @deprecated  Use userAPI.getWatchlist() + TanStack Query instead.
 * This watchlist hook uses a different table ('watchlist') than the
 * production code ('user_watchlist'). Keep for legacy compat only.
 */
export const useWatchlist = (profileId: string) => {
  return useQuery({
    queryKey: ['watchlist-legacy', profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('watchlist')
        .select('*, anime(*)')
        .eq('profile_id', profileId);

      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
    staleTime: 2 * 60 * 1000,
  });
};
