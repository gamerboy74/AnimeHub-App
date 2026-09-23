import React, { useState } from 'react'
import {
  Play,
  RotateCcw,
  RotateCw,
  Sliders,
  Download,
  ShieldCheck,
  Zap,
  ChevronRight,
  ChevronLeft,
  Heart,
  Eye,
  Film,
  MessageSquare,
  Bookmark,
  Tv,
  Headphones,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface AppScreensShowcaseProps {
  onOpenDownload: () => void
}

export function AppScreensShowcase({ onOpenDownload }: AppScreensShowcaseProps) {
  const [activeScreen, setActiveScreen] = useState<'player' | 'details' | 'offline'>('player')
  const [isPlaying, setIsPlaying] = useState(true)

  return (
    <section id="desktop-screens" className="hidden md:block py-20 lg:py-24 relative overflow-hidden bg-[#06070B] border-t border-b border-white/5">
      {/* Background Lighting Elements */}
      <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-[#FF2B3C]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[500px] h-[500px] bg-[#38BDF8]/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
          <Badge variant="default" className="text-xs">
            Authentic Mobile Architecture
          </Badge>
          <h2 className="font-display text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Designed for Anime Purists.{' '}
            <span className="text-gradient-crimson">Perfected to Every Pixel.</span>
          </h2>
          <p className="text-base text-slate-400 leading-relaxed">
            Unlike clumsy browser web-views, AnimeHub is built as a genuine Android application with a cinema-grade video pipeline, rich character encyclopedia, and native offline storage.
          </p>

          {/* Screen Tab Switcher */}
          <div className="flex items-center justify-center pt-2 sm:pt-4">
            <div className="grid grid-cols-1 xs:grid-cols-3 sm:flex sm:flex-row items-center justify-center gap-1.5 p-1.5 rounded-2xl bg-[#10121A] border border-white/10 shadow-xl shadow-black/60 w-full max-w-md sm:max-w-none">
              <button
                type="button"
                onClick={() => setActiveScreen('player')}
                className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
                  activeScreen === 'player'
                    ? 'bg-[#FF2B3C] text-white shadow-lg shadow-[#FF2B3C]/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Play className="size-3.5 sm:size-4 fill-current shrink-0" />
                <span>Cinema Player <span className="text-[10px] sm:text-xs opacity-90">(1080p)</span></span>
              </button>
              <button
                type="button"
                onClick={() => setActiveScreen('details')}
                className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
                  activeScreen === 'details'
                    ? 'bg-[#FF2B3C] text-white shadow-lg shadow-[#FF2B3C]/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Film className="size-3.5 sm:size-4 shrink-0" />
                <span>Details &amp; Cast</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveScreen('offline')}
                className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
                  activeScreen === 'offline'
                    ? 'bg-[#FF2B3C] text-white shadow-lg shadow-[#FF2B3C]/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Download className="size-3.5 sm:size-4 shrink-0" />
                <span>Offline Vault</span>
              </button>
            </div>
          </div>
        </div>

        {/* 1. CINEMA VIDEO PLAYER SHOWCASE */}
        {activeScreen === 'player' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-in fade-in duration-300">
            {/* Left: Interactive Landscape Player Visual */}
            <div className="lg:col-span-7 flex justify-center w-full">
              <div className="w-full max-w-[620px] rounded-[28px] sm:rounded-[36px] bg-[#10121A] p-2.5 sm:p-3 border-4 border-slate-700/60 shadow-2xl shadow-black/80 ring-1 ring-white/10">
                <div className="relative w-full aspect-[16/10] sm:aspect-[20/9] min-h-[220px] sm:min-h-[260px] rounded-[22px] sm:rounded-[28px] overflow-hidden bg-black flex flex-col justify-between p-3 sm:p-4 select-none">
                  <img
                    src="https://s4.anilist.co/file/anilistcdn/media/anime/banner/20809-Cjon1rP2AnD2.png"
                    alt="Lord Marksman and Vanadis scene"
                    className="absolute inset-0 w-full h-full object-cover brightness-[0.88]"
                    onError={(e) => {
                      e.currentTarget.src = '/screenshots/real-app-player.png'
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-black/80 pointer-events-none" />

                  {/* Top HUD */}
                  <div className="relative z-20 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[8px] sm:text-[10px] font-bold text-[#38BDF8] uppercase tracking-wider leading-none mb-1 truncate">
                        LORD MARKSMAN AND VANADIS
                      </div>
                      <div className="text-xs sm:text-sm font-black text-white leading-none truncate">
                        S1:E2 • The Return Home
                      </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      <div className="bg-black/80 backdrop-blur-md px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border border-white/15 font-mono text-[8px] sm:text-[10px] text-slate-300">
                        <span className="text-[#FF2B3C] font-bold">6:46</span> / 24:10
                      </div>
                      <span className="bg-black/70 px-1.5 sm:px-2 py-0.5 rounded-md border border-[#38BDF8]/60 text-[8px] sm:text-[10px] text-[#38BDF8] font-bold">
                        SUB 1
                      </span>
                      <span className="hidden xs:inline bg-black/70 px-2 py-0.5 rounded-md border border-white/15 text-[9px] sm:text-[10px] text-slate-300">
                        EPISODES
                      </span>
                    </div>
                  </div>

                  {/* Center Controls */}
                  <div className="relative z-20 flex items-center justify-center gap-5 sm:gap-8 my-auto">
                    <button
                      type="button"
                      className="size-8 sm:size-10 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white flex flex-col items-center justify-center hover:scale-105 transition-transform"
                    >
                      <RotateCcw className="size-3 sm:size-4" />
                      <span className="text-[7px] sm:text-[8px] font-bold font-mono">10</span>
                    </button>

                    {/* Signature Neon Green Glowing Pause Ring */}
                    <button
                      type="button"
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="size-11 sm:size-14 rounded-full bg-[#10121A] text-white flex items-center justify-center shadow-[0_0_35px_rgba(0,230,118,0.7)] ring-2 sm:ring-4 ring-[#00E676] hover:scale-110 active:scale-95 transition-all p-2.5 sm:p-3"
                    >
                      {isPlaying ? (
                        <div className="flex items-center gap-1 sm:gap-1.5">
                          <div className="w-1 sm:w-1.5 h-4 sm:h-5 bg-[#FF2B3C] rounded-sm" />
                          <div className="w-1 sm:w-1.5 h-4 sm:h-5 bg-[#FF2B3C] rounded-sm" />
                        </div>
                      ) : (
                        <Play className="size-5 sm:size-6 fill-[#FF2B3C] text-[#FF2B3C] ml-0.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      className="size-8 sm:size-10 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white flex flex-col items-center justify-center hover:scale-105 transition-transform"
                    >
                      <RotateCw className="size-3 sm:size-4" />
                      <span className="text-[7px] sm:text-[8px] font-bold font-mono">10</span>
                    </button>
                  </div>

                  {/* Bottom Scrubber & Strip */}
                  <div className="relative z-20 space-y-1 sm:space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] sm:text-[10px] font-mono text-white font-bold">6:46</span>
                      <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-[#FF2B3C] rounded-full w-[28%]" />
                      </div>
                      <span className="text-[8px] sm:text-[10px] font-mono text-slate-400">24:10</span>
                    </div>

                    <div className="flex items-center justify-end gap-1 sm:gap-2 pt-0.5 flex-wrap xs:flex-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-black/70 border border-[#38BDF8]/60 text-[#38BDF8] text-[8px] sm:text-[10px] font-bold flex items-center gap-1">
                        <Sliders className="size-2.5 sm:size-3" />
                        <span>1080p FHD</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-black/70 border border-[#38BDF8]/60 text-[#38BDF8] text-[8px] sm:text-[10px] font-bold flex items-center gap-1">
                        <Headphones className="size-2.5 sm:size-3" />
                        <span>English Dub</span>
                      </span>
                      <span className="hidden xs:inline px-2 py-0.5 rounded-md bg-black/70 border border-[#38BDF8]/60 text-[#38BDF8] text-[8px] sm:text-[10px] font-black uppercase tracking-wider">
                        SETTINGS
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Technical Highlights */}
            <div className="lg:col-span-5 space-y-6 text-left">
              <div>
                <span className="text-xs font-mono font-bold text-[#FF2B3C] tracking-wider uppercase">
                  // NATIVE VIDEO PIPELINE
                </span>
                <h3 className="text-2xl sm:text-3xl font-display font-black text-white mt-1">
                  True 1080p Streaming with Instant Dual-Audio
                </h3>
                <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                  Our custom Android player bypasses browser overhead, delivering continuous 60 FPS hardware-accelerated streams in the highest quality possible.
                </p>
              </div>

              <div className="space-y-3.5">
                {[
                  {
                    icon: Tv,
                    title: '1080p FHD at Highest Quality Possible',
                    desc: 'Crisp, uncompressed video frames with zero pixelation and adaptive HLS bitrates.',
                  },
                  {
                    icon: Headphones,
                    title: 'Instant Sub & Dub Toggle',
                    desc: 'Switch between Japanese audio with styled subtitles and English dub without reloading.',
                  },
                  {
                    icon: Zap,
                    title: 'Tactile Neon Controls & 10s Skip',
                    desc: 'Signature neon-green HUD with responsive double-tap and 10s seek buttons.',
                  },
                  {
                    icon: ShieldCheck,
                    title: 'Zero Ads, Zero Buffering Drops',
                    desc: 'No malware ads, countdown timers, or intrusive banners. Pure anime from first second to end credits.',
                  },
                ].map((f, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-2xl bg-[#10121A] border border-white/5">
                    <div className="size-9 rounded-xl bg-[#FF2B3C]/10 border border-[#FF2B3C]/30 text-[#FF2B3C] flex items-center justify-center shrink-0 mt-0.5">
                      <f.icon className="size-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white leading-snug">{f.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                variant="glow"
                onClick={onOpenDownload}
                className="gap-2 font-bold w-full sm:w-auto"
              >
                <span>Experience Player in APK</span>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* 2. ANIME DETAILS & CAST SHOWCASE */}
        {activeScreen === 'details' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-in fade-in duration-300">
            {/* Left: Authentic Details Card Visual */}
            <div className="lg:col-span-7 flex justify-center w-full">
              <div className="w-full max-w-[460px] rounded-[28px] sm:rounded-[36px] bg-[#10121A] p-3.5 sm:p-4 border-4 border-slate-700/60 shadow-2xl shadow-black/80 ring-1 ring-white/10 text-left space-y-3.5 sm:space-y-4">
                {/* Header with Back and Trailer */}
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono text-slate-400">ANIME DETAILS</div>
                  <span className="px-3 py-1 rounded-xl bg-black/70 border border-[#FF2B3C] text-[#FF2B3C] text-xs font-black flex items-center gap-1.5 shadow-sm shadow-[#FF2B3C]/30">
                    <Play className="size-2.5 fill-current" />
                    <span>TRAILER</span>
                  </span>
                </div>

                {/* Hero Banner with Poster */}
                <div className="flex gap-3 sm:gap-3.5 items-start">
                  <div className="relative w-20 h-28 sm:w-24 sm:h-36 rounded-xl sm:rounded-2xl overflow-hidden shrink-0 border-2 border-[#FF2B3C] shadow-xl shadow-[#FF2B3C]/25 bg-[#161924]">
                    <img
                      src="https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx178789-hNXjKFzUq7mk.jpg"
                      alt="Mushoku Tensei Season 3"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <h4 className="font-display font-black text-base text-white leading-tight">
                      Mushoku Tensei: Jobless Reincarnation Season 3
                    </h4>
                    <p className="text-[11px] text-slate-400 font-sans">
                      無職転生III ～異世界行ったら本気だす～
                    </p>
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#161924] text-slate-300 border border-white/5">
                        2026
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#161924] text-slate-300 border border-white/5">
                        tv
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#161924] text-slate-300 border border-white/5">
                        ongoing
                      </span>
                    </div>
                  </div>
                </div>

                {/* Continue Watching Button & Actions */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveScreen('player')}
                    className="flex-1 h-12 rounded-2xl bg-[#FF2B3C] hover:bg-[#FF4757] text-white flex items-center justify-center gap-2.5 px-3 shadow-lg shadow-[#FF2B3C]/40 transition-colors"
                  >
                    <Play className="size-4 fill-current ml-0.5" />
                    <div className="text-left">
                      <div className="text-xs font-black tracking-wide leading-none">
                        CONTINUE WATCHING
                      </div>
                      <div className="text-[10px] text-white/80 font-mono mt-0.5 leading-none">
                        EP 1 • 12m watched
                      </div>
                    </div>
                  </button>

                  <div className="size-12 rounded-2xl bg-[#161924] border border-white/10 flex items-center justify-center text-slate-300">
                    <Bookmark className="size-4" />
                  </div>
                  <div className="size-12 rounded-2xl bg-[#161924] border border-white/10 flex items-center justify-center text-slate-300">
                    <Heart className="size-4" />
                  </div>
                </div>

                {/* 4 Stats Metrics */}
                <div className="grid grid-cols-4 rounded-2xl bg-[#161924] border border-white/10 p-2.5 divide-x divide-white/5 text-center">
                  <div className="flex flex-col items-center">
                    <Film className="size-3.5 text-[#FF2B3C] mb-0.5" />
                    <span className="text-xs font-black text-white">14</span>
                    <span className="text-[9px] text-slate-400">Episodes</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Eye className="size-3.5 text-[#FF2B3C] mb-0.5" />
                    <span className="text-xs font-black text-white">2</span>
                    <span className="text-[9px] text-slate-400">Watches</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Heart className="size-3.5 text-[#FF2B3C] mb-0.5" />
                    <span className="text-xs font-black text-white">0</span>
                    <span className="text-[9px] text-slate-400">Favorites</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <MessageSquare className="size-3.5 text-[#FF2B3C] mb-0.5" />
                    <span className="text-xs font-black text-white">0</span>
                    <span className="text-[9px] text-slate-400">Reviews</span>
                  </div>
                </div>

                {/* Characters & Voice Actors Gallery */}
                <div className="space-y-2 pt-1">
                  <div className="text-xs font-mono font-black text-[#FF2B3C] tracking-wider">
                    {'// CHARACTERS & VOICE ACTORS'}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      {
                        name: 'Rudeus Greyrat',
                        role: 'MAIN',
                        va: 'Madeleine Morris',
                        avatar: 'https://s4.anilist.co/file/anilistcdn/character/large/b127993-yU9Z58F6ZqgG.png',
                      },
                      {
                        name: 'Sylphiette',
                        role: 'MAIN',
                        va: 'Ai Kayano',
                        avatar: 'https://s4.anilist.co/file/anilistcdn/character/large/b127995-sH9U4Yc6iU9L.png',
                      },
                      {
                        name: 'Eris Boreas',
                        role: 'MAIN',
                        va: 'Lindsay Seidel',
                        avatar: 'https://s4.anilist.co/file/anilistcdn/character/large/b127994-xU8Z38wX9a.png',
                      },
                      {
                        name: 'Roxy Migurdia',
                        role: 'MAIN',
                        va: 'Konomi Kohara',
                        avatar: 'https://s4.anilist.co/file/anilistcdn/character/large/b127996-uQ7M18eF3c.png',
                      },
                    ].map((char, i) => (
                      <div key={i} className="flex flex-col items-center text-center">
                        <div className="size-12 rounded-full overflow-hidden border border-[#FF2B3C]/50 bg-[#161924] mb-1">
                          <img
                            src={char.avatar}
                            alt={char.name}
                            onError={(e) => {
                              e.currentTarget.src = '/icon.png'
                            }}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="text-[10px] font-bold text-white truncate w-full">
                          {char.name}
                        </span>
                        <span className="text-[8px] text-[#38BDF8] truncate w-full">
                          {char.va}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Technical Highlights */}
            <div className="lg:col-span-5 space-y-6 text-left">
              <div>
                <span className="text-xs font-mono font-bold text-[#FF2B3C] tracking-wider uppercase">
                  // DEEP ANIME ENCYCLOPEDIA
                </span>
                <h3 className="text-2xl sm:text-3xl font-display font-black text-white mt-1">
                  Full Cast Rosters, Voice Actors &amp; Cloud Progress
                </h3>
                <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                  Every anime entry features complete character profiles, dual-language voice actor credits, studio information, and real-time community engagement metrics.
                </p>
              </div>

              <div className="space-y-3.5">
                {[
                  {
                    icon: Headphones,
                    title: 'Japanese & English Voice Actor Credits',
                    desc: 'Discover who voices your favorite heroes across both original Japanese seiyuu and English dub casts.',
                  },
                  {
                    icon: Play,
                    title: 'Instant Minute-Accurate Resume',
                    desc: 'Continue watching button tracks your exact second in the episode and cloud-syncs across your devices.',
                  },
                  {
                    icon: Film,
                    title: 'Direct Episode Guide & Trailing',
                    desc: 'Watch trailers before committing, browse episodes with progress indicators, and queue downloads.',
                  },
                  {
                    icon: Download,
                    title: 'One-Tap Vault Storage',
                    desc: 'Download episodes directly to your local Android device for plane rides and train commutes.',
                  },
                ].map((f, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-2xl bg-[#10121A] border border-white/5">
                    <div className="size-9 rounded-xl bg-[#FF2B3C]/10 border border-[#FF2B3C]/30 text-[#FF2B3C] flex items-center justify-center shrink-0 mt-0.5">
                      <f.icon className="size-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white leading-snug">{f.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                variant="glow"
                onClick={onOpenDownload}
                className="gap-2 font-bold w-full sm:w-auto"
              >
                <span>Download AnimeHub APK</span>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* 3. OFFLINE DOWNLOADS & VAULT SHOWCASE */}
        {activeScreen === 'offline' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-in fade-in duration-300">
            {/* Left: Authentic Offline Screen Card Visual */}
            <div className="lg:col-span-7 flex justify-center w-full">
              <div className="w-full max-w-[460px] rounded-[28px] sm:rounded-[36px] bg-[#10121A] p-3.5 sm:p-5 border-4 border-slate-700/60 shadow-2xl shadow-black/80 ring-1 ring-white/10 text-left space-y-3.5 sm:space-y-4">
                {/* Header: Back & Title */}
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="size-8 sm:size-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white shrink-0">
                    <ChevronLeft className="size-4 sm:size-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-black text-lg sm:text-xl text-white leading-tight">
                      Offline Library
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-400 font-sans">
                      2 titles available offline
                    </p>
                  </div>
                </div>

                {/* Sort Bar */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] font-mono font-bold text-slate-400 tracking-wider">
                    SORT:
                  </span>
                  <span className="px-3 py-1 rounded-full bg-[#FF2B3C]/10 border border-[#FF2B3C] text-white text-xs font-bold shadow-sm shadow-[#FF2B3C]/20">
                    Recent
                  </span>
                  <span className="px-3 py-1 rounded-full bg-[#141722] border border-white/5 text-slate-400 text-xs font-medium">
                    Title (A-Z)
                  </span>
                  <span className="px-3 py-1 rounded-full bg-[#141722] border border-white/5 text-slate-400 text-xs font-medium">
                    Largest Size
                  </span>
                </div>

                {/* List of Offline Titles */}
                <div className="space-y-3 pt-2">
                  {/* Title 1 */}
                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#141722]/60 border border-white/5 hover:border-[#FF2B3C]/30 transition-all group">
                    <div className="flex items-center gap-3.5">
                      <div className="relative w-14 h-20 rounded-xl overflow-hidden shrink-0 border border-white/10 shadow-md bg-[#161924]">
                        <img
                          src="/screenshots/poster-mushoku-offline.png"
                          alt="Mushoku Tensei Season 3"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <h4 className="font-bold text-sm text-white group-hover:text-[#FF4757] transition-colors leading-snug">
                          Mushoku Tensei: Jobless<br />Reincarnation Season 3
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#0c2233] border border-[#38BDF8]/30 text-[#38BDF8] font-bold text-xs">
                            <Film className="size-3" />
                            <span>1 EP</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#2a0e14] border border-[#FF2B3C]/30 text-[#FF4757] font-bold text-xs font-mono">
                            <Bookmark className="size-3" />
                            <span>155.8 MB</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-slate-500 group-hover:text-white transition-colors pr-2">
                      <ChevronRight className="size-5" />
                    </div>
                  </div>

                  {/* Title 2 */}
                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#141722]/60 border border-white/5 hover:border-[#FF2B3C]/30 transition-all group">
                    <div className="flex items-center gap-3.5">
                      <div className="relative w-14 h-20 rounded-xl overflow-hidden shrink-0 border border-white/10 shadow-md bg-[#161924]">
                        <img
                          src="/screenshots/poster-vanadis-offline.png"
                          alt="Lord Marksman and Vanadis"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <h4 className="font-bold text-sm text-white group-hover:text-[#FF4757] transition-colors leading-snug">
                          Lord Marksman and Vanadis
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#0c2233] border border-[#38BDF8]/30 text-[#38BDF8] font-bold text-xs">
                            <Film className="size-3" />
                            <span>1 EP</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#2a0e14] border border-[#FF2B3C]/30 text-[#FF4757] font-bold text-xs font-mono">
                            <Bookmark className="size-3" />
                            <span>269.2 MB</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-slate-500 group-hover:text-white transition-colors pr-2">
                      <ChevronRight className="size-5" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Technical Highlights */}
            <div className="lg:col-span-5 space-y-6 text-left">
              <div>
                <span className="text-xs font-mono font-bold text-[#FF2B3C] tracking-wider uppercase">
                  // LOCAL STORAGE ENGINE
                </span>
                <h3 className="text-2xl sm:text-3xl font-display font-black text-white mt-1">
                  High-Speed Offline Downloads with Zero Data Usage
                </h3>
                <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                  Download entire anime seasons straight to your device. Watch offline with zero buffer interruptions, zero cellular data consumed, and full 1080p playback support.
                </p>
              </div>

              <div className="space-y-3.5">
                {[
                  {
                    icon: Download,
                    title: 'Direct Multi-Threaded Download Engine',
                    desc: 'Download episodes up to 4x faster with segmented chunk streaming directly into app storage.',
                  },
                  {
                    icon: Zap,
                    title: 'Precision File Size Accounting',
                    desc: 'Accurate MB reporting per episode (e.g. 155.8 MB, 269.2 MB) with smart storage cleanup.',
                  },
                  {
                    icon: Tv,
                    title: 'Full 1080p Offline Video Playback',
                    desc: 'Downloaded files preserve maximum bitrate, subtitle styling, and audio dual-tracks without degradation.',
                  },
                  {
                    icon: ShieldCheck,
                    title: 'Hardware-Encrypted App Sandbox',
                    desc: 'Episodes are protected within the native app container, isolated from phone gallery clutter.',
                  },
                ].map((f, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-2xl bg-[#10121A] border border-white/5">
                    <div className="size-9 rounded-xl bg-[#FF2B3C]/10 border border-[#FF2B3C]/30 text-[#FF2B3C] flex items-center justify-center shrink-0 mt-0.5">
                      <f.icon className="size-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white leading-snug">{f.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                variant="glow"
                onClick={onOpenDownload}
                className="gap-2 font-bold w-full sm:w-auto"
              >
                <span>Download AnimeHub APK</span>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
