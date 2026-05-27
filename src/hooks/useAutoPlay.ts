/**
 * src/hooks/useAutoPlay.ts
 *
 * Single source of truth for the "Auto-play next episode" preference.
 * Reads from user_preferences via a lightweight in-memory cache so the
 * watch screen doesn't re-fetch on every render.
 *
 * Usage:
 *   const { autoPlayEnabled } = useAutoPlay();
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { userAPI } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useAutoPlay() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: prefs } = useQuery({
    queryKey: ['user', user?.id, 'preferences'],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await userAPI.getPreferences(user.id);
      return data;
    },
    enabled: !!user?.id,
    staleTime: 10_000,
  });

  const autoPlayEnabled = prefs?.auto_play_next !== false;

  const setAutoPlay = async (enabled: boolean) => {
    if (!user?.id) return;
    
    // Optimistically update the cache
    const currentPrefs = queryClient.getQueryData<any>(['user', user.id, 'preferences']) || {};
    const updatedPrefs = { ...currentPrefs, auto_play_next: enabled };
    queryClient.setQueryData(['user', user.id, 'preferences'], updatedPrefs);

    // Save to database
    await userAPI.updatePreferences(user.id, updatedPrefs);
    
    // Invalidate query to trigger sync
    queryClient.invalidateQueries({ queryKey: ['user', user.id, 'preferences'] });
  };

  return { autoPlayEnabled, setAutoPlay };
}
