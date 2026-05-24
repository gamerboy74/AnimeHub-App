/**
 * src/hooks/usePremium.ts
 *
 * Single source of truth for premium access checks.
 * Use this everywhere instead of checking user.subscription_type directly.
 */

import { useAuth } from '../context/AuthContext';
import { useCallback } from 'react';

export function usePremium() {
  const { user } = useAuth();
  const isPremium = user?.subscription_type === 'premium';

  /**
   * Returns true if the user can watch this episode.
   * Free episodes: always watchable.
   * Premium episodes: only for premium subscribers.
   */
  const canWatch = useCallback(
    (isPremiumEpisode: boolean) => !isPremiumEpisode || isPremium,
    [isPremium],
  );

  return { isPremium, canWatch, user };
}
