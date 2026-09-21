/**
 * src/lib/userStats.ts
 *
 * Unified utilities for calculating user statistics:
 * watch streak, genres breakdown, watch time, and relative timestamps.
 * Shared between profile.tsx, stats.tsx, and other screens.
 */

export const GENRE_COLORS = [
  '#00F5FF', // Cyan
  '#BF5FFF', // Neon Purple
  '#FF7346', // Coral
  '#FFD600', // Gold
  '#FF2D78', // Hot Pink
  '#00F5B4', // Mint
];

export interface GenreStat {
  name: string;
  percent: number;
  color: string;
}

/**
 * Calculates top 4 genres and their percentage distribution from user progress rows.
 */
export function computeGenres(progress: any[]): GenreStat[] {
  const counts: Record<string, number> = {};
  for (const p of progress) {
    const genres: string[] = p.genres || p.anime_genres || [];
    for (const g of genres) {
      counts[g] = (counts[g] || 0) + 1;
    }
  }
  const total = Math.max(Object.values(counts).reduce((a, b) => a + b, 0), 1);
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count], i) => ({
      name,
      percent: Math.round((count / total) * 100),
      color: GENRE_COLORS[i % GENRE_COLORS.length],
    }));
}

/**
 * Computes consecutive active watch days ending today or yesterday.
 */
export function computeStreak(progress: any[]): number {
  const days = new Set(
    progress
      .filter(p => p.last_watched)
      .map(p => new Date(p.last_watched).toDateString())
  );
  const sorted = Array.from(days)
    .map(d => new Date(d).getTime())
    .sort((a, b) => b - a);

  let streak = 0;
  let check = new Date();
  check.setHours(0, 0, 0, 0);

  for (const ts of sorted) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((check.getTime() - d.getTime()) / 86400000);
    if (diff <= 1) {
      streak++;
      check = d;
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Computes longest consecutive watch streak across the user's entire history.
 */
export function computeLongestStreak(progress: any[]): number {
  const days = Array.from(
    new Set(
      progress
        .filter(p => p.last_watched)
        .map(p => new Date(p.last_watched).toDateString())
    )
  )
    .map(d => new Date(d).getTime())
    .sort((a, b) => a - b); // ascending

  if (days.length === 0) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < days.length; i++) {
    const diffDays = Math.round((days[i] - days[i - 1]) / 86400000);
    if (diffDays === 1) {
      cur++;
      if (cur > best) best = cur;
    } else if (diffDays > 1) {
      cur = 1;
    }
  }
  return best;
}

/**
 * Computes total watch time in seconds from real progress rows.
 */
export function computeWatchTime(progress: any[]): number {
  return progress.reduce((sum: number, p: any) => sum + (p.progress_seconds || 0), 0);
}

/**
 * Computes distinct completed anime count from progress rows.
 */
export function computeCompletedAnime(progress: any[]): number {
  const ids = new Set(
    progress.filter(p => p.is_completed).map(p => p.anime_id).filter(Boolean)
  );
  return ids.size;
}

/**
 * Formats seconds into human-readable duration (e.g. "2h 45m" or "45m").
 */
export function formatWatchTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * Formats an ISO date into relative time (e.g. "5m ago", "2h ago", "3d ago").
 */
export function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/**
 * Localized relative time formatter (supports Japanese & English).
 */
export function getLocalizedRelativeTime(isoString: string, loc: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (loc === 'ja') {
    if (mins < 60) return `${mins}分前`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}時間前`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}日前`;
    return `${Math.floor(days / 7)}週間前`;
  }
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export interface WeeklyDayActivity {
  dayLabel: string;
  dateStr: string;
  minutes: number;
  seconds: number;
  episodesCount: number;
  isToday: boolean;
}

/**
 * Computes watch activity for the past 7 days (including today).
 */
export function computeWeeklyActivity(progress: any[]): WeeklyDayActivity[] {
  const result: WeeklyDayActivity[] = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const startOfDay = new Date(now);
    startOfDay.setDate(now.getDate() - i);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(startOfDay.getDate() + 1);

    const dayLabel = startOfDay.toLocaleDateString('en-US', { weekday: 'short' });
    const dateStr = startOfDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const isToday = i === 0;

    let totalSec = 0;
    let epCount = 0;

    for (const p of progress) {
      if (!p.last_watched) continue;
      const watched = new Date(p.last_watched);
      if (watched >= startOfDay && watched < endOfDay) {
        totalSec += (p.progress_seconds || 0);
        epCount++;
      }
    }

    result.push({
      dayLabel,
      dateStr,
      minutes: Math.round(totalSec / 60),
      seconds: totalSec,
      episodesCount: epCount,
      isToday,
    });
  }

  return result;
}
