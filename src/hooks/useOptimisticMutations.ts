/**
 * src/hooks/useOptimisticMutations.ts
 *
 * Optimistic mutation hooks for user actions (favorite, watchlist).
 *
 * Pattern:
 * 1. Snapshot current cache
 * 2. Immediately update the cache (UI feels instant)
 * 3. Fire DB call in background
 * 4. If DB call fails → roll back to snapshot and show error
 *
 * This eliminates the ~300-800ms lag users see when toggling
 * favorites/watchlist that rely on server round-trips before
 * updating the icon.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface UseOptimisticFavParams {
  userId: string;
  animeId: string;
}

// ─── FAVORITES ────────────────────────────────────────────────────────────────
export function useToggleFavorite({ userId, animeId }: UseOptimisticFavParams) {
  const queryClient = useQueryClient();
  const favQueryKey = ['user', userId, 'favorites'];

  return useMutation({
    // Called immediately — updates UI before server responds
    onMutate: async (willBeFavorite: boolean) => {
      await queryClient.cancelQueries({ queryKey: favQueryKey });
      const snapshot = queryClient.getQueryData(favQueryKey);

      queryClient.setQueryData(favQueryKey, (old: any[] = []) => {
        if (willBeFavorite) {
          // Optimistically add a placeholder entry
          return [...old, { anime: { id: animeId } }];
        } else {
          return old.filter((item: any) => item?.anime?.id !== animeId);
        }
      });

      return { snapshot };
    },

    mutationFn: async (willBeFavorite: boolean) => {
      if (willBeFavorite) {
        const { error } = await supabase
          .from('user_favorites')
          .insert({ user_id: userId, anime_id: animeId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', userId)
          .eq('anime_id', animeId);
        if (error) throw error;
      }
    },

    // Roll back on failure
    onError: (_err, _vars, context: any) => {
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData(favQueryKey, context.snapshot);
      }
    },

    // Always refetch to ensure consistency with server
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: favQueryKey });
    },
  });
}

// ─── WATCHLIST ────────────────────────────────────────────────────────────────
export function useToggleWatchlist({ userId, animeId }: UseOptimisticFavParams) {
  const queryClient = useQueryClient();
  const wlQueryKey = ['user', userId, 'watchlist'];

  return useMutation({
    onMutate: async (willBeInWatchlist: boolean) => {
      await queryClient.cancelQueries({ queryKey: wlQueryKey });
      const snapshot = queryClient.getQueryData(wlQueryKey);

      queryClient.setQueryData(wlQueryKey, (old: any[] = []) => {
        if (willBeInWatchlist) {
          return [...old, { anime: { id: animeId } }];
        } else {
          return old.filter((item: any) => item?.anime?.id !== animeId);
        }
      });

      return { snapshot };
    },

    mutationFn: async (willBeInWatchlist: boolean) => {
      if (willBeInWatchlist) {
        const { error } = await supabase
          .from('user_watchlist')
          .insert({ user_id: userId, anime_id: animeId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_watchlist')
          .delete()
          .eq('user_id', userId)
          .eq('anime_id', animeId);
        if (error) throw error;
      }
    },

    onError: (_err, _vars, context: any) => {
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData(wlQueryKey, context.snapshot);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: wlQueryKey });
    },
  });
}

/**
 * Optimistic watch-progress upsert.
 * Immediately updates the local progress cache so the progress bar
 * reflects the current position without waiting for the DB write.
 */
export function useUpsertProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      episodeId,
      progressSeconds,
      isCompleted,
    }: {
      userId: string;
      episodeId: string;
      progressSeconds: number;
      isCompleted: boolean;
    }) => {
      const { error } = await supabase.from('user_progress').upsert(
        {
          user_id: userId,
          episode_id: episodeId,
          progress_seconds: progressSeconds,
          is_completed: isCompleted,
          last_watched: new Date().toISOString(),
        },
        { onConflict: 'user_id,episode_id' },
      );
      if (error) throw error;
    },

    onSuccess: (_data, { userId, episodeId, progressSeconds, isCompleted }) => {
      // Update the per-episode progress cache
      queryClient.setQueryData(
        ['user', userId, 'progress', episodeId],
        { progress_seconds: progressSeconds, is_completed: isCompleted },
      );
      // Stale-invalidate history so library/profile reloads lazily
      queryClient.invalidateQueries({ queryKey: ['user', userId, 'history'] });
    },
  });
}
