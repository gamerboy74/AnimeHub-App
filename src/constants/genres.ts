/**
 * src/constants/genres.ts
 *
 * Single source of truth for all anime genres in AnimeHub.
 * Consumed by:
 * - app/(tabs)/index.tsx (Home genre pills)
 * - app/(tabs)/explore.tsx (Bento grid and category matrix)
 * - app/genre/index.tsx (All genres showcase screen)
 */

export interface GenreMeta {
  name: string;
  icon: string;
  emoji: string;
  color: string;
  sub: string;
  grad: readonly [string, string, string];
}

export const ALL_GENRES: GenreMeta[] = [
  {
    name: 'Action',
    icon: 'flash-outline',
    emoji: '⚔️',
    color: '#FF7346',
    sub: 'High-octane battles & adrenaline',
    grad: ['transparent', 'rgba(255,115,70,0.55)', 'rgba(8,8,16,0.97)'],
  },
  {
    name: 'Sci-Fi',
    icon: 'hardware-chip-outline',
    emoji: '🚀',
    color: '#00F5FF',
    sub: 'Futuristic cyberpunk worlds',
    grad: ['transparent', 'rgba(0,245,255,0.55)', 'rgba(8,8,16,0.97)'],
  },
  {
    name: 'Fantasy',
    icon: 'sparkles-outline',
    emoji: '🔮',
    color: '#BF5FFF',
    sub: 'Magic, mythical beasts & lore',
    grad: ['transparent', 'rgba(191,95,255,0.55)', 'rgba(8,8,16,0.97)'],
  },
  {
    name: 'Adventure',
    icon: 'compass-outline',
    emoji: '🗺️',
    color: '#FFB830',
    sub: 'Epic journeys across uncharted lands',
    grad: ['transparent', 'rgba(255,184,48,0.55)', 'rgba(8,8,16,0.97)'],
  },
  {
    name: 'Romance',
    icon: 'heart-outline',
    emoji: '💕',
    color: '#FF2D78',
    sub: 'Heartfelt emotional stories',
    grad: ['transparent', 'rgba(255,45,120,0.55)', 'rgba(8,8,16,0.97)'],
  },
  {
    name: 'Comedy',
    icon: 'happy-outline',
    emoji: '😂',
    color: '#FFE54C',
    sub: 'Non-stop laughs & humor',
    grad: ['transparent', 'rgba(255,229,76,0.55)', 'rgba(8,8,16,0.97)'],
  },
  {
    name: 'Drama',
    icon: 'heart-half-outline',
    emoji: '🎭',
    color: '#E8C4FF',
    sub: 'Deep emotional connections',
    grad: ['transparent', 'rgba(232,196,255,0.5)', 'rgba(8,8,16,0.97)'],
  },
  {
    name: 'Thriller',
    icon: 'eye-outline',
    emoji: '😱',
    color: '#FF6B6B',
    sub: 'Edge-of-your-seat suspense',
    grad: ['transparent', 'rgba(255,107,107,0.55)', 'rgba(8,8,16,0.97)'],
  },
  {
    name: 'Horror',
    icon: 'skull-outline',
    emoji: '🩸',
    color: '#FF3333',
    sub: 'Spine-chilling terror & thrills',
    grad: ['transparent', 'rgba(139,0,0,0.7)', 'rgba(8,8,16,0.97)'],
  },
  {
    name: 'Mystery',
    icon: 'search-outline',
    emoji: '🔍',
    color: '#9B8FFF',
    sub: 'Unraveling hidden secrets',
    grad: ['transparent', 'rgba(155,143,255,0.55)', 'rgba(8,8,16,0.97)'],
  },
  {
    name: 'Sports',
    icon: 'football-outline',
    emoji: '🏆',
    color: '#00D4AA',
    sub: 'Passion, sweat & tournament glory',
    grad: ['transparent', 'rgba(0,212,170,0.55)', 'rgba(8,8,16,0.97)'],
  },
  {
    name: 'Slice of Life',
    icon: 'cafe-outline',
    emoji: '🌸',
    color: '#A8E6CF',
    sub: 'Heartwarming everyday moments',
    grad: ['transparent', 'rgba(168,230,207,0.5)', 'rgba(8,8,16,0.97)'],
  },
  {
    name: 'Mecha',
    icon: 'hardware-chip-outline',
    emoji: '🤖',
    color: '#7EC8E3',
    sub: 'Giant robots & technological warfare',
    grad: ['transparent', 'rgba(126,200,227,0.55)', 'rgba(8,8,16,0.97)'],
  },
  {
    name: 'Supernatural',
    icon: 'flame-outline',
    emoji: '👁️',
    color: '#C77DFF',
    sub: 'Spirits, curses & occult phenomena',
    grad: ['transparent', 'rgba(199,125,255,0.55)', 'rgba(8,8,16,0.97)'],
  },
  {
    name: 'Isekai',
    icon: 'planet-outline',
    emoji: '🌀',
    color: '#FFC300',
    sub: 'Transported to another realm',
    grad: ['transparent', 'rgba(255,195,0,0.55)', 'rgba(8,8,16,0.97)'],
  },
  {
    name: 'Historical',
    icon: 'book-outline',
    emoji: '📜',
    color: '#D4A574',
    sub: 'Feudal eras, samurai & legend',
    grad: ['transparent', 'rgba(212,165,116,0.55)', 'rgba(8,8,16,0.97)'],
  },
];

export const GENRE_NAMES = ALL_GENRES.map(g => g.name);
