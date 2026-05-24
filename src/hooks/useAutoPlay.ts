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

import { useState, useEffect } from 'react';
import { userAPI } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useAutoPlay() {
  const { user } = useAuth();
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true); // default on

  useEffect(() => {
    if (!user?.id) return;
    userAPI.getPreferences(user.id).then(({ data }) => {
      if (data && typeof data.auto_play_next === 'boolean') {
        setAutoPlayEnabled(data.auto_play_next);
      }
    });
  }, [user?.id]);

  return { autoPlayEnabled };
}
