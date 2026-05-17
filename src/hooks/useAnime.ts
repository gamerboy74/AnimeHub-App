import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export const useTrendingAnime = () => {
  return useQuery({
    queryKey: ['anime', 'trending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('anime')
        .select('*')
        .order('score', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
  });
};

export const useAnimeDetails = (id: string) => {
  return useQuery({
    queryKey: ['anime', 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('anime')
        .select('*, episodes(*)')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
};

export const useWatchlist = (profileId: string) => {
  return useQuery({
    queryKey: ['watchlist', profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('watchlist')
        .select('*, anime(*)')
        .eq('profile_id', profileId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
  });
};
