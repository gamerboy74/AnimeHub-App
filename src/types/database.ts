export interface Anime {
  id: string;
  title: string;
  title_japanese?: string;
  description?: string;
  poster_url?: string;
  banner_url?: string;
  trailer_url?: string;
  rating?: number;
  year?: number;
  status?: string;
  type?: string;
  genres?: string[];
  studios?: string[];
  total_episodes?: number;
  duration?: number;
  age_rating?: string;
}

export interface AnimeWithStats extends Anime {
  actual_episode_count?: number;
  free_episode_count?: number;
  premium_episode_count?: number;
  favorite_count?: number;
  watchlist_count?: number;
  total_watches?: number;
  completed_watches?: number;
  review_count?: number;
  user_rating_avg?: number;
  recent_activity?: number;
}

/** A single streaming server entry stored in episodes.video_servers */
export interface VideoServer {
  name: string;  // 'Server 1' | 'Server 2' | 'Backup' | etc.
  url: string;   // full embed URL
}

export interface Episode {
  id: string;
  anime_id: string;
  episode_number: number;
  title?: string;
  description?: string;
  thumbnail_url?: string;
  video_url?: string;
  duration?: number;
  is_premium: boolean;   // always present in DB — not optional
  air_date?: string;
  /** Ordered list of stream servers. Falls back to [{name:'Server 1', url: video_url}] */
  video_servers?: VideoServer[];
}

// ⚠️  User type has been moved to src/lib/supabase.ts
// Import from there to get the authoritative type that matches the DB columns.
// Re-exporting here for backwards compatibility:
export type { User } from '../lib/supabase';

export interface UserActivitySummary {
  user_id?: string;
  username?: string;
  email?: string;
  subscription_type?: string;
  user_created_at?: string;
  total_episodes_watched?: number;
  completed_episodes?: number;
  favorite_count?: number;
  watchlist_count?: number;
  review_count?: number;
  recent_activity?: number;
  last_activity?: string;
}

export interface UserWatchProgressDetailed {
  progress_id?: string;
  user_id?: string;
  progress_seconds?: number;
  is_completed?: boolean;
  last_watched?: string;
  episode_id?: string;
  episode_number?: number;
  episode_title?: string;
  thumbnail_url?: string;
  episode_duration?: number;
  anime_id?: string;
  anime_title?: string;
  poster_url?: string;
  banner_url?: string;
  progress_percentage?: number;
}
