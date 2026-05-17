import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface AnimeState {
  trending: any[];
  featured: any | null;
  isLoading: boolean;
  error: string | null;
  fetchTrending: () => Promise<void>;
  setFeatured: (anime: any) => void;
}

export const useAnimeStore = create<AnimeState>((set) => ({
  trending: [],
  featured: null,
  isLoading: false,
  error: null,

  fetchTrending: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('anime')
        .select('*')
        .order('score', { ascending: false })
        .limit(10);

      if (error) throw error;
      set({ trending: data || [], isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  setFeatured: (anime) => set({ featured: anime }),
}));
