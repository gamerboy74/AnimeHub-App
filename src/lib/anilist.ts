/**
 * src/lib/anilist.ts
 *
 * Fetches currently trending anime from the AniList public GraphQL API,
 * then cross-references with your Supabase DB using mal_id.
 *
 * Result: Only anime that are BOTH trending on AniList AND exist in your DB
 * are returned — so users only see what they can actually watch.
 */

import { animeAPI, supabase } from './supabase';
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

// In-memory cache for AniList trending results (10 min TTL)
let cachedAniListTrending: { data: AniListAnime[]; timestamp: number } | null = null;
const ANILIST_CACHE_TTL_MS = 10 * 60 * 1000;

/** Fetch trending anime from AniList with caching and error resilience */
export async function fetchAniListTrending(perPage = 50): Promise<AniListAnime[]> {
  const now = Date.now();
  if (cachedAniListTrending && now - cachedAniListTrending.timestamp < ANILIST_CACHE_TTL_MS) {
    return cachedAniListTrending.data;
  }

  try {
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
    const items: AniListAnime[] = json?.data?.Page?.media ?? [];
    if (items.length > 0) {
      cachedAniListTrending = { data: items, timestamp: now };
    }
    return items;
  } catch (err) {
    if (cachedAniListTrending?.data) {
      console.warn('[AniList] Trending request failed, serving cached data:', err);
      return cachedAniListTrending.data;
    }
    throw err;
  }
}

/**
 * Fetch trending anime from AniList and filter to only those
 * that exist in your Supabase DB (matched by mal_id).
 *
 * Returns the full `AnimeWithStats` rows from your DB, in AniList trending order.
 */
export async function fetchTrendingFromDB(limit = 10): Promise<AnimeWithStats[]> {
  // 1. Get AniList trending (fetch 50 items so we match as many in DB as possible)
  const aniListTrending = await fetchAniListTrending(50);

  // 2. Extract mal_ids that AniList returned (skip anime with no MAL entry)
  const malIds = aniListTrending
    .map(a => a.idMal)
    .filter((id): id is number => id !== null && id > 0);

  if (malIds.length === 0) return [];

  // 3. Fast O(1) in-memory lookup using cached malIdMap from Supabase
  const malIdMap = await animeAPI.getMalIdMap();
  const rankedIds: string[] = [];
  for (const idMal of malIds) {
    const uuid = malIdMap.get(idMal);
    if (uuid && !rankedIds.includes(uuid)) {
      rankedIds.push(uuid);
      if (rankedIds.length >= limit) break;
    }
  }

  if (rankedIds.length === 0) return [];

  // 4. Fetch full stats from the view using UUIDs
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
 * Primary trending fetch:
 * 1. Queries AniList TRENDING_DESC cross-referenced with DB (shows what's actually trending right now).
 * 2. If fewer than `limit` are found, pads with recent modern anime from DB (2024–2026).
 * 3. Never falls back to ancient 2002–2012 anime sorted by total_watches at the top of Trending.
 */
export async function fetchTrendingWithFallback(limit = 10): Promise<AnimeWithStats[]> {
  let results: AnimeWithStats[] = [];
  try {
    results = await fetchTrendingFromDB(limit);
  } catch (e) {
    console.warn('[AniList] Trending fetch failed, falling back to DB:', e);
  }

  if (results.length >= limit) {
    return results.slice(0, limit);
  }

  // Pad or fallback with recent modern anime from DB (2024–2026)
  const existingIds = new Set(results.map(a => a.id));
  const currentYear = new Date().getFullYear();
  const minYear = currentYear - 2;

  try {
    const { data: recentHot } = await supabase
      .from('anime_with_stats')
      .select('id, title, title_japanese, poster_url, banner_url, rating, year, status, type, genres, total_episodes, user_rating_avg, review_count, total_watches')
      .not('poster_url', 'is', null)
      .gte('year', minYear)
      .order('total_watches', { ascending: false })
      .limit(limit);

    if (recentHot?.length) {
      for (const item of recentHot as AnimeWithStats[]) {
        if (!existingIds.has(item.id)) {
          existingIds.add(item.id);
          results.push(item);
          if (results.length >= limit) return results;
        }
      }
    }
  } catch (err) {
    console.warn('[AniList] Failed to pad trending with recent DB anime:', err);
  }

  // If still under limit (e.g. for "See All" requesting 60 items), pad with top-rated
  if (results.length < limit) {
    try {
      const { data: topRated } = await supabase
        .from('anime_with_stats')
        .select('id, title, title_japanese, poster_url, banner_url, rating, year, status, type, genres, total_episodes, user_rating_avg, review_count, total_watches')
        .not('poster_url', 'is', null)
        .order('user_rating_avg', { ascending: false })
        .limit(limit);

      if (topRated?.length) {
        for (const item of topRated as AnimeWithStats[]) {
          if (!existingIds.has(item.id)) {
            existingIds.add(item.id);
            results.push(item);
            if (results.length >= limit) return results;
          }
        }
      }
    } catch (err) {
      console.warn('[AniList] Fallback top-rated query failed:', err);
    }
  }

  return results;
}
