/**
 * src/constants/badges.ts
 *
 * Single source of truth for all badge definitions.
 * Imported by both profile.tsx and stats.tsx so they always
 * show the same badges. Add new badges here ONLY.
 */

export interface BadgeDef {
  id: string;
  code: string;
  name: string;
  desc: string;
  icon: string;
  color: string;
  check: (progress: any[], streak: number, watchlist?: any[]) => boolean;
  progress: (progress: any[], streak: number, watchlist?: any[]) => { cur: number; max: number };
}

// Imported lazily to avoid circular deps with theme — use raw hex values here.
const NEON       = '#FF2B3C';
const NEON_CYAN  = '#38BDF8';
const NEON_GOLD  = '#FFB800';
const NEON_PULSE = '#00E676';
const NEON_PINK  = '#FF4757';

export const BADGE_DEFS: BadgeDef[] = [
  {
    id: '1', code: 'FIRST_EP', name: 'FIRST EP', desc: 'Watch any episode',
    icon: 'play-circle', color: NEON,
    check:    (p) => p.length >= 1,
    progress: (p) => ({ cur: Math.min(p.length, 1), max: 1 }),
  },
  {
    id: '2', code: 'HUNTER', name: 'HUNTER', desc: 'Add 1 to watchlist',
    icon: 'bookmark', color: '#00FFCC',
    check:    (_p, _s, w = []) => w.length >= 1,
    progress: (_p, _s, w = []) => ({ cur: Math.min(w.length, 1), max: 1 }),
  },
  {
    id: '3', code: 'DEDICATED', name: 'DEDICATED', desc: '3-day watch streak',
    icon: 'flash', color: NEON_CYAN,
    check:    (_p, s) => s >= 3,
    progress: (_p, s) => ({ cur: Math.min(s, 3), max: 3 }),
  },
  {
    id: '4', code: 'LISTER', name: 'LISTER', desc: 'Add 5 to watchlist',
    icon: 'list', color: NEON_PULSE,
    check:    (_p, _s, w = []) => w.length >= 5,
    progress: (_p, _s, w = []) => ({ cur: Math.min(w.length, 5), max: 5 }),
  },
  {
    id: '5', code: 'SHONEN', name: 'SHONEN', desc: 'Watch 5 Action episodes',
    icon: 'flame', color: '#FF3E3E',
    check:    (p) => p.filter(x => (x.genres || x.anime_genres || []).includes('Action')).length >= 5,
    progress: (p) => {
      const c = p.filter(x => (x.genres || x.anime_genres || []).includes('Action')).length;
      return { cur: Math.min(c, 5), max: 5 };
    },
  },
  {
    id: '6', code: 'VETERAN', name: 'VETERAN', desc: 'Watch 10 episodes',
    icon: 'medal', color: '#ff7346',
    check:    (p) => p.length >= 10,
    progress: (p) => ({ cur: Math.min(p.length, 10), max: 10 }),
  },
  {
    id: '7', code: 'WARRIOR', name: 'WARRIOR', desc: '7-day streak',
    icon: 'shield', color: NEON_GOLD,
    check:    (_p, s) => s >= 7,
    progress: (_p, s) => ({ cur: Math.min(s, 7), max: 7 }),
  },
  {
    id: '8', code: 'BINGE', name: 'BINGE SENSEI', desc: 'Watch 5 hours of anime',
    icon: 'time', color: '#FFB300',
    check:    (p) => p.reduce((sum, x) => sum + (x.progress_seconds || 0), 0) >= 18_000,
    progress: (p) => {
      const sec = p.reduce((sum, x) => sum + (x.progress_seconds || 0), 0);
      return { cur: Math.min(sec, 18_000), max: 18_000 };
    },
  },
  {
    id: '9', code: 'LEGEND', name: 'LEGEND', desc: 'Watch 50 episodes',
    icon: 'star', color: NEON_GOLD,
    check:    (p) => p.length >= 50,
    progress: (p) => ({ cur: Math.min(p.length, 50), max: 50 }),
  },
  {
    id: '10', code: 'OTAKU', name: 'OTAKU KING', desc: 'Watch 100 episodes',
    icon: 'trophy', color: NEON,
    check:    (p) => p.length >= 100,
    progress: (p) => ({ cur: Math.min(p.length, 100), max: 100 }),
  },
];
