/**
 * useAnimeStore — lightweight Zustand store for ephemeral UI state.
 *
 * NOTE: Trending data is owned by TanStack Query (useTrendingAnime hook).
 * This store no longer maintains its own copy; fetchTrending is a no-op
 * placeholder kept for backward compatibility. Use useTrendingAnime() directly
 * in new screens.
 */
import { create } from 'zustand';

interface AnimeState {
  featured: any | null;
  setFeatured: (anime: any) => void;
  // Deprecated — kept for backward compat. Use useTrendingAnime() instead.
  trending: any[];
  isLoading: boolean;
  error: string | null;
  fetchTrending: () => Promise<void>;
}

export const useAnimeStore = create<AnimeState>((set) => ({
  featured: null,
  trending: [],
  isLoading: false,
  error: null,

  setFeatured: (anime) => set({ featured: anime }),

  // No-op: trending is now managed by TanStack Query (useTrendingAnime).
  // Remove callers of this function and use useTrendingAnime() directly.
  fetchTrending: async () => {
    console.warn('[useAnimeStore] fetchTrending is deprecated. Use useTrendingAnime() from src/hooks/useQueries.ts');
  },
}));
