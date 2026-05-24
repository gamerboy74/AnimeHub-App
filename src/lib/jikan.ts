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

/** Raw Jikan fetch (deduplicated by mal_id) */
async function fetchJikan(type: JikanListType): Promise<JikanEntry[]> {
  const res = await fetch(JIKAN_ENDPOINTS[type], {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Jikan error ${res.status}`);
  const json = await res.json();
  const items: JikanEntry[] = json.data ?? [];

  // Deduplicate by mal_id
  const seen = new Set<number>();
  return items.filter(e => {
    if (seen.has(e.mal_id)) return false;
    seen.add(e.mal_id);
    return true;
  });
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
  const MIN_RESULTS = 3; // if Jikan matches fewer than this, just use DB

  let jikanResults: AnimeWithStats[] = [];
  try {
    jikanResults = await fetchJikanFilteredByDB(type, limit);
  } catch (e) {
    console.warn(`[Jikan] ${type} fetch failed, falling back to DB:`, e);
  }

  // Enough Jikan matches — use them directly
  if (jikanResults.length >= MIN_RESULTS) return jikanResults;

  // Not enough matches — fetch from DB directly
  const orderCol = type === 'top-rated' ? 'user_rating_avg' : 'rating';
  const { data } = await supabase
    .from('anime_with_stats')
    .select('id, title, title_japanese, poster_url, banner_url, rating, year, status, type, genres, total_episodes, user_rating_avg, review_count, total_watches')
    .not('poster_url', 'is', null)
    .order(orderCol, { ascending: false })
    .limit(limit);

  const dbResults = (data ?? []) as AnimeWithStats[];

  // If we had a few Jikan matches, put them first then pad with DB (no duplicates)
  if (jikanResults.length > 0) {
    const jikanIds = new Set(jikanResults.map(a => a.id));
    const padded = dbResults.filter(a => !jikanIds.has(a.id));
    return [...jikanResults, ...padded].slice(0, limit);
  }

  return dbResults;
}
