import React from 'react'
import { Cpu, Zap, Database, Check, X, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function ArchitectureSection() {
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

  return (
    <section id="architecture" className="py-24 relative overflow-hidden bg-[#08090D]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <Badge variant="purple" className="text-xs">
            Architectural Supremacy
          </Badge>
          <h2 className="font-display text-3xl sm:text-5xl font-black text-white tracking-tight">
            How AnimeHub <span className="text-gradient-neon">Outperforms the Rest</span>
          </h2>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            We rejected the common practice of wrapping bloated web pages into an app shell. Every screen, gesture HUD, and video buffer was built natively.
          </p>
        </div>

        {/* 3 Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {pillars.map((item, idx) => {
            const Icon = item.icon
            return (
              <div
                key={idx}
                className={`p-6 rounded-3xl bg-[#10121A]/80 backdrop-blur-xl border border-white/10 hover:${item.border} transition-all duration-300 hover:shadow-xl`}
              >
                <div className={`size-12 rounded-2xl bg-[#161924] border border-white/10 flex items-center justify-center ${item.color} mb-4`}>
                  <Icon className="size-6" />
                </div>
                <h3 className="font-display text-lg font-bold text-white mb-2">{item.title}</h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            )
          })}
        </div>

        {/* Comparison Table */}
        <div className="rounded-3xl border border-white/10 bg-[#10121A]/90 overflow-hidden shadow-2xl">
          <div className="p-6 sm:p-8 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-xl font-bold text-white">
                Benchmark Comparison
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Direct head-to-head comparison between AnimeHub Native and typical streaming sites.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-[11px]">
                AnimeHub v1.0.2
              </Badge>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
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
                      <Sparkles className="size-3.5 text-[#FF2B3C]" />
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
