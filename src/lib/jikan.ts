/**
 * src/lib/jikan.ts
 *
 * Fetches trending/top-rated/new-arrival anime from Jikan (MAL proxy),
 * then cross-references with your Supabase DB using mal_id.
 *
 * This is the SAME source used by AnimeListScreen ("See All" pages),
 * so home row data and the "See All" page always show identical content.
 */

import { animeAPI, supabase } from './supabase';
import type { AnimeWithStats } from './supabase';
import { fetchTrendingWithFallback } from './anilist';

// ─── Jikan API endpoints ───────────────────────────────────────────────────────
const JIKAN_ENDPOINTS = {
  trending:    'https://api.jikan.moe/v4/top/anime?filter=airing&limit=25',
  'top-rated': 'https://api.jikan.moe/v4/top/anime?limit=25',
  'new-arrivals': 'https://api.jikan.moe/v4/seasons/now?limit=25',
} as const;

export type JikanListType = keyof typeof JIKAN_ENDPOINTS;

export interface JikanEntry {
  mal_id: number;
  title: string;
  title_english?: string;
  images: { jpg: { large_image_url?: string; image_url: string } };
  score?: number;
  type?: string;
  year?: number;
  synopsis?: string;
  genres?: { name: string }[];
  status?: string;
}

// In-memory cache to strictly comply with Jikan's rate limits (3 req/s, 60 req/min)
const jikanCache = new Map<string, { data: JikanEntry[]; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Raw Jikan fetch with in-memory caching and 429 rate limit protection */
async function fetchJikan(type: JikanListType): Promise<JikanEntry[]> {
  const cached = jikanCache.get(type);
  const now = Date.now();

  // Return cached result if fresh
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const res = await fetch(JIKAN_ENDPOINTS[type], {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      // If rate limited (429) or error, serve stale cache if available
      if (cached?.data) {
        console.warn(`[Jikan] ${res.status} error for ${type}, serving stale cache.`);
        return cached.data;
      }
      throw new Error(`Jikan error ${res.status}`);
    }

    const json = await res.json();
    const items: JikanEntry[] = json.data ?? [];

    // Deduplicate by mal_id
    const seen = new Set<number>();
    const deduplicated = items.filter(e => {
      if (seen.has(e.mal_id)) return false;
      seen.add(e.mal_id);
      return true;
    });

    // Cache fresh results
    jikanCache.set(type, { data: deduplicated, timestamp: now });
    return deduplicated;
  } catch (err) {
    if (cached?.data) {
      console.warn(`[Jikan] Network error for ${type}, serving stale cache:`, err);
      return cached.data;
    }
    throw err;
  }
}

/**
 * Fetches Jikan list → filters to anime your DB has → returns full DB rows
 * sorted in Jikan rank order.
 *
 * @param type  'trending' | 'top-rated' | 'new-arrivals'
 * @param limit max results to return
 */
export async function fetchJikanFilteredByDB(
  type: JikanListType,
  limit = 15,
): Promise<AnimeWithStats[]> {
  // 1. Fetch Jikan + build mal_id map in parallel
  const [jikanItems, malIdMap] = await Promise.all([
    fetchJikan(type),
    animeAPI.getMalIdMap(),
  ]);

  if (malIdMap.size === 0) return []; // DB not loaded yet

  // 2. Filter to only anime we have, preserving Jikan rank order
  const rankedIds = jikanItems
    .filter(e => malIdMap.has(e.mal_id))
    .slice(0, limit)
    .map(e => malIdMap.get(e.mal_id)!); // supabase UUIDs in rank order

  if (rankedIds.length === 0) return [];

  // 3. Fetch full DB rows for those UUIDs
  const { data, error } = await supabase
    .from('anime_with_stats')
    .select('id, title, title_japanese, poster_url, banner_url, rating, year, status, type, genres, total_episodes, user_rating_avg, review_count, total_watches')
    .in('id', rankedIds);

  if (error) throw error;
  if (!data?.length) return [];

  // 4. Re-sort by Jikan rank order (Supabase .in() doesn't preserve order)
  const idRank = new Map(rankedIds.map((id, i) => [id, i]));
  return [...data].sort((a, b) => (idRank.get(a.id) ?? 99) - (idRank.get(b.id) ?? 99)) as AnimeWithStats[];
}

/**
 * Same as fetchJikanFilteredByDB but with a DB-native fallback
 * so the home screen always shows something even if few Jikan matches exist.
 *
 * Falls back to DB when:
 *   - Jikan is unreachable (error)
 *   - Fewer than MIN_RESULTS anime in the DB match Jikan's list
 *
 * Also top-ups with DB results when Jikan returned SOME but fewer than `limit`.
 */
export async function fetchJikanWithFallback(
  type: JikanListType,
  limit = 15,
): Promise<AnimeWithStats[]> {
  // For 'trending', use AniList with DB recency fallback.
  // AniList provides accurate real-time trending data and avoids Jikan's 3 req/sec rate limit.
  if (type === 'trending') {
    return fetchTrendingWithFallback(limit);
  }

  let jikanResults: AnimeWithStats[] = [];
  try {
    jikanResults = await fetchJikanFilteredByDB(type, limit);
  } catch (e) {
    console.warn(`[Jikan] ${type} fetch failed, falling back to DB:`, e);
  }

  // If Jikan returned enough matches to fulfill limit, return them
  if (jikanResults.length >= limit) return jikanResults.slice(0, limit);

  // Otherwise, fetch from DB directly to pad up to limit
  const orderCol = type === 'top-rated' ? 'user_rating_avg' : 'created_at';
  const { data } = await supabase
    .from('anime_with_stats')
    .select('id, title, title_japanese, poster_url, banner_url, rating, year, status, type, genres, total_episodes, user_rating_avg, review_count, total_watches')
    .not('poster_url', 'is', null)
    .order(orderCol, { ascending: false })
    .limit(limit);

  const dbResults = (data ?? []) as AnimeWithStats[];

  // Put Jikan matches first, then pad with remaining DB anime without duplicates
  if (jikanResults.length > 0) {
    const jikanIds = new Set(jikanResults.map(a => a.id));
    const padded = dbResults.filter(a => !jikanIds.has(a.id));
    return [...jikanResults, ...padded].slice(0, limit);
  }

  return dbResults;
}

export type AnimeSeason = 'summer' | 'spring' | 'winter' | 'fall';

export interface SeasonalTarget {
  year: number;
  season: AnimeSeason;
  label: string;
}

export const SEASONS_LIST: SeasonalTarget[] = [
  { year: 2026, season: 'summer', label: 'Summer 2026' },
  { year: 2026, season: 'spring', label: 'Spring 2026' },
  { year: 2026, season: 'winter', label: 'Winter 2026' },
  { year: 2025, season: 'fall',   label: 'Fall 2025' },
];

/**
 * Fetches anime for a specific season (Spring 2026, Summer 2026, Winter 2026, Fall 2025),
 * matching against Jikan and cross-referencing with our local DB.
 */
export async function fetchJikanSeasonWithFallback(
  year: number,
  season: AnimeSeason,
  limit = 24,
): Promise<AnimeWithStats[]> {
  let jikanItems: JikanEntry[] = [];

  try {
    const res = await fetch(`https://api.jikan.moe/v4/seasons/${year}/${season}?limit=25`, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const json = await res.json();
      jikanItems = json.data ?? [];
    }
  } catch (err) {
    console.warn(`[Jikan] Error fetching season ${season} ${year}:`, err);
  }

  // Cross-reference with DB
  const malIdMap = await animeAPI.getMalIdMap();
  const matchedUuids = jikanItems
    .filter(item => malIdMap.has(item.mal_id))
    .map(item => malIdMap.get(item.mal_id)!);

  let matchedDbAnime: AnimeWithStats[] = [];
  if (matchedUuids.length > 0) {
    const { data } = await supabase
      .from('anime_with_stats')
      .select('id, title, title_japanese, poster_url, banner_url, rating, year, status, type, genres, total_episodes, user_rating_avg, review_count, total_watches')
      .in('id', matchedUuids);
    matchedDbAnime = (data ?? []) as AnimeWithStats[];
  }

  // Pad or fallback with DB anime from matching year
  if (matchedDbAnime.length < limit) {
    const { data: dbSeasonAnime } = await supabase
      .from('anime_with_stats')
      .select('id, title, title_japanese, poster_url, banner_url, rating, year, status, type, genres, total_episodes, user_rating_avg, review_count, total_watches')
      .eq('year', year)
      .not('poster_url', 'is', null)
      .order('total_watches', { ascending: false })
      .limit(limit);

    const existingIds = new Set(matchedDbAnime.map(a => a.id));
    const padded = ((dbSeasonAnime ?? []) as AnimeWithStats[]).filter(a => !existingIds.has(a.id));
    matchedDbAnime = [...matchedDbAnime, ...padded];
  }

  // If still under 5 anime (e.g. for upcoming 2026), pad with ongoing broadcasting series
  if (matchedDbAnime.length < 5) {
    const { data: ongoingAnime } = await supabase
      .from('anime_with_stats')
      .select('id, title, title_japanese, poster_url, banner_url, rating, year, status, type, genres, total_episodes, user_rating_avg, review_count, total_watches')
      .ilike('status', '%ongoing%')
      .not('poster_url', 'is', null)
      .order('total_watches', { ascending: false })
      .limit(limit);

    const existingIds = new Set(matchedDbAnime.map(a => a.id));
    const padded = ((ongoingAnime ?? []) as AnimeWithStats[]).filter(a => !existingIds.has(a.id));
    matchedDbAnime = [...matchedDbAnime, ...padded];
  }

  return matchedDbAnime.slice(0, limit);
}
