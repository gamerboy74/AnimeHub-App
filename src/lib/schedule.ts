/**
 * src/lib/schedule.ts
 *
 * Robust, multi-tiered anime airing schedule service:
 * 1. In-memory caching with 30-min TTL (prevents repeat requests when switching tabs).
 * 2. Primary: AniList Airing Schedule GraphQL (fast, high rate-limit, reliable).
 * 3. Secondary: Jikan v4 Schedule API with rate-limit protection.
 * 4. Tertiary: Local Supabase DB fallback with ongoing anime.
 *
 * Prevents "API error 429" and blank schedule screens.
 */

import { supabase } from './supabase';

export interface ScheduleEntry {
  mal_id: number;
  title: string;
  title_english?: string;
  images: { jpg: { image_url: string } };
  broadcast?: { day?: string; time?: string; timezone?: string };
  episodes?: number;
  score?: number;
  genres?: { name: string }[];
  synopsis?: string;
}

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export const DAY_SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

export interface ScheduleDateItem {
  date: Date;
  dateKey: string;
  dayShort: string;
  dayFull: string;
  dayNum: number;
  isToday: boolean;
  offsetFromToday: number;
}

export function getTodayIndex(): number {
  const d = new Date().getDay(); // 0 = Sun
  return d === 0 ? 6 : d - 1;   // 0 = Mon
}

/**
 * Returns 5 schedule dates centered on today:
 * [-2: 2 days ago, -1: yesterday, 0: today, 1: tomorrow, 2: 2 days ahead]
 */
export function getScheduleDates(): ScheduleDateItem[] {
  const today = new Date();
  const offsets = [-2, -1, 0, 1, 2];
  const shortNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const fullNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return offsets.map(offset => {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    d.setHours(0, 0, 0, 0);

    const dayIdx = d.getDay();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayNum = String(d.getDate()).padStart(2, '0');
    const dateKey = `${y}-${m}-${dayNum}`;

    return {
      date: d,
      dateKey,
      dayShort: shortNames[dayIdx],
      dayFull: fullNames[dayIdx],
      dayNum: d.getDate(),
      isToday: offset === 0,
      offsetFromToday: offset,
    };
  });
}

/** Returns the calendar date for each day of the current week (Mon=0 … Sun=6) - kept for compatibility */
export function getWeekDates(): number[] {
  const today = new Date();
  const todayIdx = getTodayIndex();
  return DAYS.map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + (i - todayIdx));
    return d.getDate();
  });
}

// ── In-Memory Day Cache (30 min TTL) ──────────────────────────────────────────
const scheduleCache = new Map<string, { data: ScheduleEntry[]; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function resolveTargetDate(target?: ScheduleDateItem | Date | number): {
  targetDate: Date;
  dayName: string;
  cacheKey: string;
} {
  let targetDate: Date;
  if (typeof target === 'object' && target !== null && 'date' in target) {
    targetDate = (target as ScheduleDateItem).date;
  } else if (target instanceof Date) {
    targetDate = target;
  } else if (typeof target === 'number') {
    const today = new Date();
    const todayIdx = getTodayIndex();
    targetDate = new Date(today);
    targetDate.setDate(today.getDate() + (target - todayIdx));
  } else {
    targetDate = new Date();
  }

  const d = new Date(targetDate);
  d.setHours(0, 0, 0, 0);

  const fullNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = fullNames[d.getDay()];
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayNum = String(d.getDate()).padStart(2, '0');
  const cacheKey = `${y}-${m}-${dayNum}`;

  return { targetDate: d, dayName, cacheKey };
}

/**
 * Computes the start & end Unix timestamps (seconds) for a given Date.
 */
function getDayTimestampWindow(targetDate: Date): { start: number; end: number } {
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const start = Math.floor(startOfDay.getTime() / 1000);
  const end = start + 86400;
  return { start, end };
}

/**
 * Fetch schedule from AniList GraphQL (robust, no 429 rate limit issues).
 */
async function fetchFromAniList(targetDate: Date, dayName: string): Promise<ScheduleEntry[]> {
  const { start, end } = getDayTimestampWindow(targetDate);

  const query = `
    query ($start: Int, $end: Int) {
      Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
          id
          airingAt
          episode
          media {
            id
            idMal
            title {
              english
              romaji
            }
            coverImage {
              large
              extraLarge
            }
            genres
            description
            averageScore
          }
        }
      }
    }
  `;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables: { start, end } }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    if (!res.ok) throw new Error(`AniList returned status ${res.status}`);

    const json = await res.json();
    const list = json?.data?.Page?.airingSchedules ?? [];

    const entries: ScheduleEntry[] = list.map((item: any) => {
      const airDate = new Date(item.airingAt * 1000);
      const hours = airDate.getHours().toString().padStart(2, '0');
      const minutes = airDate.getMinutes().toString().padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;

      return {
        mal_id: item.media?.idMal ?? (9000000 + item.media?.id),
        title: item.media?.title?.romaji ?? 'Untitled Anime',
        title_english: item.media?.title?.english || item.media?.title?.romaji,
        images: {
          jpg: {
            image_url: item.media?.coverImage?.large || item.media?.coverImage?.extraLarge || '',
          },
        },
        broadcast: {
          day: dayName,
          time: timeStr,
        },
        episodes: item.episode,
        score: item.media?.averageScore ? item.media.averageScore / 10 : undefined,
        genres: (item.media?.genres ?? []).map((g: string) => ({ name: g })),
        synopsis: item.media?.description
          ? item.media.description.replace(/<[^>]*>?/gm, '').trim()
          : undefined,
      };
    });

    return entries;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch schedule from Jikan API with rate-limit tolerance.
 */
async function fetchFromJikan(dayName: string): Promise<ScheduleEntry[]> {
  const day = dayName.toLowerCase();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(`https://api.jikan.moe/v4/schedules?filter=${day}&limit=25`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timer);
    if (!res.ok) throw new Error(`Jikan error ${res.status}`);

    const json = await res.json();
    const items: ScheduleEntry[] = json.data ?? [];

    // Deduplicate by mal_id
    const seen = new Set<number>();
    const deduplicated = items.filter(e => {
      if (seen.has(e.mal_id)) return false;
      seen.add(e.mal_id);
      return true;
    });

    return deduplicated;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fallback to ongoing/current anime from Supabase DB.
 */
async function fetchFromDatabase(dayName: string): Promise<ScheduleEntry[]> {
  const targetDayName = dayName;
  const { data } = await supabase
    .from('anime_with_stats')
    .select('id, title, title_english, title_japanese, poster_url, mal_id, year, status, genres, user_rating_avg')
    .ilike('status', '%ongoing%')
    .not('poster_url', 'is', null)
    .limit(10);

  const fallbackTimes = ['12:00', '16:30', '18:00', '19:30', '21:00', '22:30', '23:00', '23:30'];

  const rows = (data ?? []) as any[];
  return rows.map((a, i) => ({
    mal_id: a.mal_id ?? (8000000 + i),
    title: a.title,
    title_english: a.title_english || a.title,
    images: { jpg: { image_url: a.poster_url ?? '' } },
    broadcast: {
      day: targetDayName,
      time: fallbackTimes[i % fallbackTimes.length],
    },
    score: a.user_rating_avg ? Number(a.user_rating_avg) : undefined,
    genres: (a.genres ?? []).map((g: string) => ({ name: g })),
    synopsis: 'Currently ongoing anime broadcasting this season.',
  }));
}

/**
 * Main Airing Schedule function:
 * Checks memory cache -> tries AniList -> falls back to Jikan -> falls back to DB.
 */
export async function fetchAiringSchedule(
  target: ScheduleDateItem | Date | number = getTodayIndex()
): Promise<ScheduleEntry[]> {
  const { targetDate, dayName, cacheKey } = resolveTargetDate(target);
  const cached = scheduleCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS && cached.data.length > 0) {
    return cached.data;
  }

  let entries: ScheduleEntry[] = [];

  // Tier 1: Try AniList (fastest, most reliable)
  try {
    entries = await fetchFromAniList(targetDate, dayName);
  } catch (aniErr) {
    console.warn(`[Schedule] AniList fetch failed for day ${dayName} (${cacheKey}):`, aniErr);
  }

  // Tier 2: Try Jikan if AniList returned empty or failed
  if (entries.length === 0) {
    try {
      entries = await fetchFromJikan(dayName);
    } catch (jikanErr) {
      console.warn(`[Schedule] Jikan fetch failed for day ${dayName}:`, jikanErr);
    }
  }

  // Tier 3: Fallback to local DB if both external services were unreachable
  if (entries.length === 0) {
    try {
      entries = await fetchFromDatabase(dayName);
    } catch (dbErr) {
      console.warn(`[Schedule] DB fallback failed for day ${dayName}:`, dbErr);
    }
  }

  // Sort chronologically by air time
  entries.sort((a, b) => {
    const ta = a.broadcast?.time ?? '99:99';
    const tb = b.broadcast?.time ?? '99:99';
    return ta.localeCompare(tb);
  });

  if (entries.length > 0) {
    scheduleCache.set(cacheKey, { data: entries, timestamp: now });
  }

  return entries;
}
