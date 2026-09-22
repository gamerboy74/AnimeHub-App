import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://ieopfdxgjlmdsidikgbj.supabase.co'
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imllb3BmZHhnamxtZHNpZGlrZ2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1Mjg1MDgsImV4cCI6MjA3NjEwNDUwOH0.8MaTqu67m1EUnWQk1UUol2OHnFcP6k0vpcdI7EVX3aE'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

export interface DBAnime {
  id: string
  title: string
  title_japanese?: string
  poster_url: string
  banner_url?: string
  rating?: number
  year?: number
  status?: string
  type?: string
  genres?: string[]
  total_episodes?: number
  description?: string
}

// In-memory cache to prevent redundant database roundtrips
let cachedNewestAnime: { data: DBAnime[]; timestamp: number } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// Curated instant-fallback data directly from the AnimeHub database
export const FALLBACK_NEWEST_ANIME: DBAnime[] = [
  {
    id: 'd57e0f2a-8e09-49ad-a3dd-e6da33fb91da',
    title: 'Saga of Tanya the Evil',
    title_japanese: '幼女戦記',
    poster_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx21613-qT3NiwYP5dYc.png',
    banner_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/21613-FGAqKSTvfxuA.png',
    rating: 7.8,
    year: 2017,
    status: 'completed',
    type: 'tv',
    genres: ['Action', 'Fantasy', 'Military'],
    total_episodes: 12,
    description: 'A ruthless office worker is reincarnated as a young girl in an alternate magical world war, rising through the imperial military ranks.',
  },
  {
    id: '4eb723ac-ada0-409a-a91b-4233015e7fea',
    title: 'A Silent Voice',
    title_japanese: '聲の形',
    poster_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx20954-sYRfE5jQRtSB.jpg',
    banner_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/20954-f30bHMXa5Qoe.jpg',
    rating: 8.8,
    year: 2016,
    status: 'completed',
    type: 'movie',
    genres: ['Drama', 'Romance', 'Slice of Life'],
    total_episodes: 1,
    description: 'A former elementary school bully seeks redemption by reconnecting with the deaf girl he once tormented.',
  },
  {
    id: '060dbc1e-fe43-4d58-ab73-ce9ad9cff454',
    title: 'My Hero Academia FINAL SEASON',
    title_japanese: '僕のヒーローアカデミア FINAL SEASON',
    poster_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx182896-mvxTVHGdDB4q.jpg',
    banner_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/182896-iJt79hYTpv8w.jpg',
    rating: 8.7,
    year: 2025,
    status: 'completed',
    type: 'tv',
    genres: ['Action', 'Adventure', 'Super Power'],
    total_episodes: 11,
    description: 'Deku and the heroes enter the climactic final war to stop Shigaraki and All For One once and for all.',
  },
  {
    id: 'c40fed87-f137-4635-8889-33d6b3fdea13',
    title: 'My Hero Academia Season 7',
    title_japanese: '僕のヒーローアカデミア 7',
    poster_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx163139-JchZhUFlNTWU.jpg',
    banner_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/163139-UWM3qDG5cRa6.jpg',
    rating: 8.2,
    year: 2024,
    status: 'completed',
    type: 'tv',
    genres: ['Action', 'Adventure'],
    total_episodes: 21,
    description: 'America’s top hero Star and Stripe arrives in Japan as heroes prepare for the ultimate showdown against villains.',
  },
  {
    id: '1d43899e-d0ed-4f8a-bad7-a3c6a562d4ff',
    title: 'My Dress-Up Darling',
    title_japanese: 'その着せ替え人形は恋をする',
    poster_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx132405-qP7FQYGmNI3d.jpg',
    banner_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/132405-LnPQaqaksEpN.jpg',
    rating: 8.0,
    year: 2022,
    status: 'completed',
    type: 'tv',
    genres: ['Comedy', 'Romance', 'Cosplay'],
    total_episodes: 12,
    description: 'Wakana Gojou, a dollmaker artisan, forms an unexpected creative partnership with outgoing cosplayer Marin Kitagawa.',
  },
  {
    id: '3bd54fcb-195a-434d-8c34-f1571f403857',
    title: 'Sword Art Online II',
    title_japanese: 'ソードアート・オンライン II',
    poster_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/nx20594-FhRgZ1H9Istt.jpg',
    banner_url: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/20594-BZOLwqidcS1G.jpg',
    rating: 6.5,
    year: 2014,
    status: 'completed',
    type: 'tv',
    genres: ['Action', 'Adventure', 'Sci-Fi'],
    total_episodes: 24,
    description: 'Kirito dives into the gritty gun-slinging MMO Gun Gale Online to investigate a serial killer known as Death Gun.',
  },
]

/**
 * Optimized DB fetcher for newly added anime.
 * - Selects only necessary columns (narrow projection)
 * - Excludes entries with missing poster_url
 * - Orders by created_at DESC
 * - Caches in-memory for 5 minutes
 */
export async function getNewlyAddedAnime(limit = 6): Promise<DBAnime[]> {
  const now = Date.now()
  if (cachedNewestAnime && now - cachedNewestAnime.timestamp < CACHE_TTL_MS) {
    return cachedNewestAnime.data.slice(0, limit)
  }

  try {
    const { data, error } = await supabase
      .from('anime_with_stats')
      .select('id, title, title_japanese, poster_url, banner_url, rating, year, status, type, genres, total_episodes, description')
      .not('poster_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.warn('[Supabase] Failed to fetch newest anime, using fallback cache:', error)
      return FALLBACK_NEWEST_ANIME.slice(0, limit)
    }

    if (data && data.length > 0) {
      cachedNewestAnime = { data, timestamp: now }
      return data
    }
  } catch (err) {
    console.warn('[Supabase] Network/exception fetching newest anime:', err)
  }

  return FALLBACK_NEWEST_ANIME.slice(0, limit)
}
