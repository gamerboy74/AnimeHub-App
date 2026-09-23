import React, { useState } from 'react'
import { Cpu, Zap, Database, Check, X, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function ArchitectureSection() {
  const [showAllSpecs, setShowAllSpecs] = useState(false)

  const specs = [
    {
      feature: 'Streaming Protocol',
      animehub: 'Adaptive HLS (m3u8) Multi-Server',
      typical: 'Embedded Iframe Web Scrapers',
    },
    {
      feature: 'Max Quality Offered',
      animehub: '1080p FHD (Highest Quality Possible)',
      typical: 'Compressed 480p/720p with stutter',
    },
    {
      feature: 'Ad Interference',
      animehub: 'Zero Ads / 0 Popups / 0 Malware',
      typical: '5-10 Popups & Aggressive Redirects',
    },
    {
      feature: 'Offline Mode',
      animehub: 'Native Encrypted Background Downloads',
      typical: 'Not Supported (Browser Only)',
    },
    {
      feature: 'Runtime Engine',
      animehub: 'Hermes 0.76 (Bytecode Optimized)',
      typical: 'Standard V8 / Heavy Browser Dom',
    },
    {
      feature: 'Frame Rate',
      animehub: 'Locked 60 FPS Native UI',
      typical: 'Laggy scrolling & choppy playback',
    },
    {
      feature: 'Cloud Sync',
      animehub: 'Supabase Real-Time Watchlist Sync',
      typical: 'Lost when browser cache clears',
    },
  ]

  const pillars = [
    {
      icon: Cpu,
      title: 'Hermes Bytecode Engine',
      desc: 'Compiled ahead-of-time bytecode allows AnimeHub to launch under 400ms and use 50% less RAM than typical hybrid apps.',
      color: 'text-[#38BDF8]',
      border: 'border-[#38BDF8]/30',
    },
    {
      icon: Zap,
      title: 'Hardware Video Decoding',
      desc: 'Direct GPU surface rendering for H.264, HEVC, and AV1 video streams ensures zero frame drops even during intense high-action sakuga scenes.',
      color: 'text-[#FF2B3C]',
      border: 'border-[#FF2B3C]/30',
    },
    {
      icon: Database,
      title: 'Supabase Real-Time Backend',
      desc: 'Instant cloud synchronization of watch history, bookmarks, avatars, and notifications with end-to-end security.',
      color: 'text-[#00E676]',
      border: 'border-[#00E676]/30',
    },
  ]

  const displayedSpecs = showAllSpecs ? specs : specs.slice(0, 4)

  return (
    <section id="architecture" className="py-10 sm:py-16 lg:py-20 relative overflow-hidden bg-[#08090D]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto space-y-2.5 sm:space-y-4 mb-8 sm:mb-14">
          <Badge variant="purple" className="text-xs">
            Architectural Supremacy
          </Badge>
          <h2 className="font-display text-2xl xs:text-3xl sm:text-5xl font-black text-white tracking-tight">
            How AnimeHub <span className="text-gradient-neon">Outperforms the Rest</span>
          </h2>
          <p className="text-xs sm:text-base text-slate-400 leading-relaxed">
            We rejected the common practice of wrapping bloated web pages into an app shell. Every screen, gesture HUD, and video buffer was built natively.
          </p>
        </div>

        {/* 3 Pillars: Mobile Horizontal Snap Carousel | Desktop 3-Col Grid */}
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-3.5 pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none md:grid md:grid-cols-3 md:gap-6 mb-8 sm:mb-14 md:overflow-visible md:pb-0">
          {pillars.map((item, idx) => {
            const Icon = item.icon
            return (
              <div
                key={idx}
                className="w-[78vw] max-w-[285px] shrink-0 snap-center md:w-auto p-4 sm:p-6 rounded-3xl bg-[#10121A]/80 backdrop-blur-xl border border-white/10 hover:border-white/20 transition-all duration-300"
              >
                <div className={`size-10 sm:size-12 rounded-2xl bg-[#161924] border border-white/10 flex items-center justify-center ${item.color} mb-3 sm:mb-4`}>
                  <Icon className="size-5 sm:size-6" />
                </div>
                <h3 className="font-display text-base sm:text-lg font-bold text-white mb-1.5 sm:mb-2">{item.title}</h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            )
          })}
        </div>

        {/* Comparison Section */}
        <div className="rounded-3xl border border-white/10 bg-[#10121A]/90 overflow-hidden shadow-2xl">
          <div className="p-4 sm:p-8 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
            <div>
              <h3 className="font-display text-base sm:text-xl font-bold text-white">
                Benchmark Comparison
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 sm:mt-1">
                Direct head-to-head comparison between AnimeHub Native and typical streaming sites.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="default" className="text-[10px] sm:text-[11px]">
                AnimeHub v1.0.2
              </Badge>
            </div>
          </div>

          {/* Mobile Comparison Cards (block on mobile, hidden on md+) */}
          <div className="block md:hidden divide-y divide-white/5">
            {displayedSpecs.map((row, idx) => (
              <div key={idx} className="p-3.5 space-y-2">
                <div className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Sparkles className="size-3 text-[#FF2B3C] shrink-0" />
                  <span>{row.feature}</span>
                </div>
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-1.5 text-xs">
                  {/* AnimeHub */}
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20">
                    <Check className="size-3.5 text-[#00E676] shrink-0" />
                    <span className="font-semibold text-emerald-300 text-[11px] leading-tight">{row.animehub}</span>
                  </div>
                  {/* Typical Websites */}
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/5">
                    <X className="size-3.5 text-rose-400 shrink-0" />
                    <span className="text-slate-400 text-[11px] leading-tight">{row.typical}</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Mobile Expand / Collapse Specs */}
            <div className="p-2.5 text-center bg-black/20">
              <button
                type="button"
                onClick={() => setShowAllSpecs(!showAllSpecs)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF6B7A] hover:text-[#FF2B3C] transition-colors py-1.5 px-3 rounded-lg hover:bg-white/5"
              >
                <span>{showAllSpecs ? 'Show Core Benchmarks (4)' : `View All (${specs.length}) Benchmarks`}</span>
                {showAllSpecs ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </button>
            </div>
          </div>

          {/* Desktop Table (hidden on mobile, block on md+) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs sm:text-sm">
              <thead className="bg-black/40 text-slate-400 font-mono text-[11px] uppercase border-b border-white/5">
                <tr>
                  <th className="py-4 px-6">Capability / Feature</th>
                  <th className="py-4 px-6 text-[#FF2B3C] font-bold">AnimeHub Native App</th>
                  <th className="py-4 px-6 text-slate-400">Typical Anime Websites</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {specs.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-6 font-medium text-white flex items-center gap-2">
                      <Sparkles className="size-3.5 text-[#FF2B3C] shrink-0" />
                      <span>{row.feature}</span>
                    </td>
                    <td className="py-4 px-6 font-semibold text-[#00E676]">
                      <div className="flex items-center gap-2">
                        <Check className="size-4 shrink-0" />
                        <span>{row.animehub}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-500">
                      <div className="flex items-center gap-2">
                        <X className="size-4 text-rose-500/80 shrink-0" />
                        <span>{row.typical}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
