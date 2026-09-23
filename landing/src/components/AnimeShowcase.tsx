import React, { useEffect, useState } from 'react'
import { Star, Play, Flame, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getNewlyAddedAnime, DBAnime, FALLBACK_NEWEST_ANIME } from '@/lib/supabase'

interface AnimeShowcaseProps {
  onOpenDownload: () => void
}

export function AnimeShowcase({ onOpenDownload }: AnimeShowcaseProps) {
  const [animeList, setAnimeList] = useState<DBAnime[]>(FALLBACK_NEWEST_ANIME)

  useEffect(() => {
    let isMounted = true
    getNewlyAddedAnime(6)
      .then((data) => {
        if (isMounted && data && data.length > 0) {
          setAnimeList(data)
        }
      })
      .catch((err) => {
        console.warn('[Showcase] Fetch error:', err)
      })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <section id="showcase" className="py-10 sm:py-16 lg:py-20 relative overflow-hidden bg-[#0A0D13]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 sm:mb-12 gap-4 sm:gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <Badge variant="neon" className="text-[11px] sm:text-xs">
                Real-Time Database Sync
              </Badge>
              <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                Live Catalog
              </span>
            </div>
            <h2 className="font-display text-2xl xs:text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Fresh Releases{' '}
              <span className="text-gradient-crimson">Newly Added to AnimeHub</span>
            </h2>
            <p className="text-xs sm:text-base text-slate-400 mt-1.5 sm:mt-2 max-w-xl leading-relaxed">
              Synced directly with our production database. Stream latest episodes and completed sagas in 1080p at the highest quality possible.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={onOpenDownload}
            className="w-full sm:w-auto justify-center gap-2 border-[#FF2B3C]/30 text-[#FF6B7A] hover:bg-[#FF2B3C]/10 h-auto min-h-[44px] py-2.5 px-4 text-xs sm:text-sm shrink-0"
          >
            <span>Explore Entire Catalog on App</span>
            <Flame className="size-4 text-[#FF2B3C]" />
          </Button>
        </div>

        {/* Mobile Horizontal Swipe Cue */}
        <div className="flex sm:hidden items-center justify-between text-[11px] text-slate-400 mb-3 px-0.5">
          <span className="flex items-center gap-1.5 font-medium text-slate-300">
            <Sparkles className="size-3.5 text-[#FF2B3C]" />
            Swipe horizontally to browse releases
          </span>
          <span className="font-mono text-[10px] text-slate-500">6 titles &rarr;</span>
        </div>

        {/* Anime Cards: Mobile Swipe Carousel | Desktop Grid */}
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-6 sm:overflow-visible sm:pb-0">
          {animeList.map((anime) => (
            <div
              key={anime.id}
              className="w-[76vw] max-w-[270px] shrink-0 snap-start sm:w-auto sm:max-w-none group relative rounded-3xl overflow-hidden bg-[#10121A] border border-white/10 hover:border-[#FF2B3C]/50 transition-all duration-300 hover:shadow-2xl hover:shadow-[#FF2B3C]/20 flex flex-col justify-between"
            >
              {/* Poster Container */}
              <div className="relative h-56 sm:h-72 overflow-hidden bg-[#161924]">
                <img
                  src={anime.poster_url}
                  alt={anime.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 brightness-90 contrast-105"
                  onError={(e) => {
                    // Fallback to banner if poster fails
                    if (anime.banner_url && e.currentTarget.src !== anime.banner_url) {
                      e.currentTarget.src = anime.banner_url
                    }
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#10121A] via-black/25 to-transparent" />

                {/* Rating Badge */}
                {anime.rating && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-xs font-bold text-[#FFB800]">
                    <Star className="size-3.5 fill-[#FFB800] text-[#FFB800]" />
                    <span>{Number(anime.rating).toFixed(1)}</span>
                  </div>
                )}

                {/* Quality & Episodes */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <span className="bg-[#FF2B3C] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                    1080p FHD
                  </span>
                  {anime.total_episodes ? (
                    <span className="bg-black/70 backdrop-blur-md text-slate-200 text-[10px] font-medium px-2.5 py-0.5 rounded-full border border-white/10">
                      {anime.total_episodes} {anime.type === 'movie' ? 'Movie' : 'Eps'}
                    </span>
                  ) : null}
                </div>

                {/* Hover Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <button
                    onClick={onOpenDownload}
                    className="size-14 rounded-full bg-[#FF2B3C] text-white flex items-center justify-center shadow-lg shadow-[#FF2B3C]/60 hover:scale-110 active:scale-95 transition-transform"
                    aria-label={`Stream ${anime.title}`}
                  >
                    <Play className="size-6 fill-current ml-1" />
                  </button>
                </div>
              </div>

              {/* Card Meta Content */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  {/* Genre Pills */}
                  {anime.genres && anime.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {anime.genres.slice(0, 3).map((g, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[#161924] text-slate-300 border border-white/5"
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  )}

                  <h3 className="font-display text-lg font-bold text-white group-hover:text-[#FF4252] transition-colors leading-snug">
                    {anime.title}
                  </h3>
                  {anime.title_japanese && (
                    <div className="text-[11px] font-mono text-slate-500 mb-2">
                      {anime.title_japanese}
                    </div>
                  )}
                  {anime.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {anime.description.replace(/<[^>]*>?/gm, '')}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                  <span className="text-[#9DA4B4] flex items-center gap-1">
                    <Sparkles className="size-3 text-[#38BDF8]" />
                    <span>{anime.year || '2026'} · Highest Quality</span>
                  </span>
                  <button
                    onClick={onOpenDownload}
                    className="font-bold text-[#FF2B3C] hover:text-[#FF6B7A] transition-colors"
                  >
                    Stream Now →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
