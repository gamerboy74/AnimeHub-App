/**
 * src/hooks/useAutoSkipIntro.ts
 *
 * Single source of truth for the "Auto-skip intro/outro" preference.
 * Reads from user_preferences via a lightweight in-memory cache so the
 * watch screen doesn't re-fetch on every render.
 *
 * Usage:
 *   const { autoSkipIntroEnabled } = useAutoSkipIntro();
 */

import { useState, useEffect } from 'react';
import { userAPI } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useAutoSkipIntro() {
  const { user } = useAuth();
  const [autoSkipIntroEnabled, setAutoSkipIntroEnabled] = useState(true); // default on

  useEffect(() => {
    if (!user?.id) return;
    userAPI.getPreferences(user.id).then(({ data }) => {
      if (data && typeof data.auto_skip_intro === 'boolean') {
        setAutoSkipIntroEnabled(data.auto_skip_intro);
      }
    });
  }, [user?.id]);

  return { autoSkipIntroEnabled };
}
