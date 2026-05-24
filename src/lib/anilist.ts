/**
 * src/lib/anilist.ts
 *
 * Fetches currently trending anime from the AniList public GraphQL API,
 * then cross-references with your Supabase DB using mal_id.
 *
 * Result: Only anime that are BOTH trending on AniList AND exist in your DB
 * are returned — so users only see what they can actually watch.
 */

import { supabase } from './supabase';
import type { AnimeWithStats } from './supabase';

const ANILIST_URL = 'https://graphql.anilist.co';

// ─── AniList GraphQL query ─────────────────────────────────────────────────────
const TRENDING_QUERY = `
  query TrendingAnime($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(sort: TRENDING_DESC, type: ANIME, isAdult: false) {
        idMal
        title {
          romaji
          english
          native
        }
        coverImage {
          extraLarge
          large
          color
        }
        bannerImage
        averageScore
        genres
        episodes
        status
        season
        seasonYear
        format
      }
    }
  }
`;

export interface AniListAnime {
  idMal: number | null;
  title: { romaji: string; english: string | null; native: string | null };
  coverImage: { extraLarge: string; large: string; color: string | null };
  bannerImage: string | null;
  averageScore: number | null;
  genres: string[];
  episodes: number | null;
  status: string;
  season: string | null;
  seasonYear: number | null;
  format: string;
}

/** Fetch trending anime from AniList (top 30) */
export async function fetchAniListTrending(perPage = 30): Promise<AniListAnime[]> {
  const res = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      query: TRENDING_QUERY,
      variables: { page: 1, perPage },
    }),
  });

  if (!res.ok) throw new Error(`AniList request failed: ${res.status}`);
  const json = await res.json();
  return json?.data?.Page?.media ?? [];
}

/**
 * Fetch trending anime from AniList and filter to only those
 * that exist in your Supabase DB (matched by mal_id).
 *
 * Returns the full `AnimeWithStats` rows from your DB, in AniList trending order.
 */
export async function fetchTrendingFromDB(limit = 10): Promise<AnimeWithStats[]> {
  // 1. Get AniList trending (fetch more than needed so we have enough after filtering)
  const aniListTrending = await fetchAniListTrending(50);

  // 2. Extract mal_ids that AniList returned (skip anime with no MAL entry)
  const malIds = aniListTrending
    .map(a => a.idMal)
    .filter((id): id is number => id !== null && id > 0);

  if (malIds.length === 0) return [];

  // 3. Look up Supabase UUIDs from the base `anime` table (mal_id lives here, NOT on the view)
  const { data: animeRows, error: lookupErr } = await supabase
    .from('anime')
    .select('id, mal_id')
    .in('mal_id', malIds);

  if (lookupErr) throw lookupErr;
  if (!animeRows?.length) return [];

  // 4. Build rank map: supabase_uuid → AniList rank
  const malIdRank = new Map(malIds.map((id, i) => [id, i]));
  const rankedIds = [...animeRows]
    .sort((a, b) => (malIdRank.get(a.mal_id) ?? 999) - (malIdRank.get(b.mal_id) ?? 999))
    .slice(0, limit)
    .map(r => r.id);

  // 5. Fetch full stats from the view using UUIDs (no mal_id needed here)
  const { data, error } = await supabase
    .from('anime_with_stats')
    .select('id, title, title_japanese, poster_url, banner_url, rating, year, status, type, genres, total_episodes, user_rating_avg, review_count, total_watches')
    .in('id', rankedIds);

  if (error) throw error;
  if (!data?.length) return [];

  // Re-sort by AniList rank (Supabase .in() doesn't preserve order)
  const idRank = new Map(rankedIds.map((id, i) => [id, i]));
  return [...data].sort((a, b) => (idRank.get(a.id) ?? 99) - (idRank.get(b.id) ?? 99)) as AnimeWithStats[];
}

/**
 * Fallback: if AniList is unreachable or no matches found,
 * fall back to your DB's own "trending" (by total_watches).
 */
export async function fetchTrendingWithFallback(limit = 10): Promise<AnimeWithStats[]> {
  try {
    const results = await fetchTrendingFromDB(limit);
    if (results.length > 0) return results;
  } catch (e) {
    console.warn('[AniList] Trending fetch failed, falling back to DB:', e);
  }

  // Fallback: DB-native trending
  const { data } = await supabase
    .from('anime_with_stats')
    .select('id, title, title_japanese, poster_url, banner_url, rating, year, status, type, genres, total_episodes, user_rating_avg, review_count, total_watches')
    .not('poster_url', 'is', null)          // must have a poster to show in hero
    .order('rating', { ascending: false })   // fallback sort: highest rated first
    .limit(limit);

  return (data ?? []) as AnimeWithStats[];
}
