import { create } from 'zustand';

interface Anime {
  id: number;
  title_english: string;
  coverImage?: string;
  // Additional fields can be added later as Supabase is integrated
}

interface Episode {
  id: string;
  number: number;
  title?: string;
  video_url?: string;
}

interface PlayerState {
  currentAnime: Anime | null;
  currentEpisode: Episode | null;
  isPlaying: boolean;
  setPlaying: (playing: boolean) => void;
  playEpisode: (anime: Anime, episode: Episode) => void;
  closePlayer: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentAnime: null,
  currentEpisode: null,
  isPlaying: false,
  setPlaying: (playing) => set({ isPlaying: playing }),
  playEpisode: (anime, episode) => set({ 
    currentAnime: anime, 
    currentEpisode: episode, 
    isPlaying: true 
  }),
  closePlayer: () => set({ 
    currentAnime: null, 
    currentEpisode: null, 
    isPlaying: false 
  })
}));
