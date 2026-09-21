/**
 * src/hooks/usePremium.ts
 *
 * Single source of truth for premium access checks.
 * Evaluates both subscription_type and dynamic expiration timestamp.
 */

import { useAuth } from '../context/AuthContext';
import { useCallback, useMemo } from 'react';

export function usePremium() {
  const { user } = useAuth();

  const isExpired = useMemo(() => {
    if (!user || user.subscription_type !== 'premium') return false;
    if (user.billing_cycle === 'admin_grant') return false; // Admin grants never expire
    if (!user.subscription_expires_at) return false;
    return new Date(user.subscription_expires_at).getTime() <= Date.now();
  }, [user]);

  const isPremium = Boolean(user?.subscription_type === 'premium' && !isExpired);

  /**
   * Returns true if the user can watch this episode.
   * Free episodes: always watchable.
   * Premium episodes: only for active premium subscribers.
   */
  const canWatch = useCallback(
    (isPremiumEpisode: boolean) => !isPremiumEpisode || isPremium,
    [isPremium],
  );

  return { isPremium, isExpired, canWatch, user };
}
