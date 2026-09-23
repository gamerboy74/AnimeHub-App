import React from 'react'
import {
  PlayCircle,
  Shield,
  DownloadCloud,
  RefreshCw,
  Headphones,
  BatteryCharging,
  Sparkles,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function FeaturesSection() {
  const features = [
    {
      icon: PlayCircle,
      iconColor: 'text-[#FF2B3C]',
      iconBg: 'bg-[#FF2B3C]/10 border-[#FF2B3C]/30',
      badge: 'Video Engine',
      title: 'Highest Quality Player',
      description:
        'Engineered to deliver anime at the highest quality possible with low-latency HLS stream buffers, variable playback speeds (0.25x to 3.0x), custom aspect ratios, double-tap seek, and zero frame drops.',
      highlight: '60 FPS Hardware Accelerated',
    },
    {
      icon: Shield,
      iconColor: 'text-[#00E676]',
      iconBg: 'bg-[#00E676]/10 border-[#00E676]/30',
      badge: 'Zero Ads',
      title: 'Distraction-Free Immersion',
      description:
        'Say goodbye to annoying pop-ups, countdown redirects, and sketchy malware banners. AnimeHub provides a completely pristine, ad-free viewing experience.',
      highlight: 'Clean & Safe',
    },
    {
      icon: DownloadCloud,
      iconColor: 'text-[#38BDF8]',
      iconBg: 'bg-[#38BDF8]/10 border-[#38BDF8]/30',
      badge: 'Offline Vault',
      title: 'Smart Offline Caching',
      description:
        'Download entire seasons directly to your local Android storage at the highest quality possible with background sync and paused download recovery.',
      highlight: 'Watch Anywhere',
    },
    {
      icon: RefreshCw,
      iconColor: 'text-[#FFB800]',
      iconBg: 'bg-[#FFB800]/10 border-[#FFB800]/30',
      badge: 'Realtime Sync',
      title: 'Cloud Watchlist & History',
      description:
        'Pick up right where you left off on any device. Powered by Supabase real-time sync with custom anime avatars, favorites, and episode progress tracking.',
      highlight: 'Cross-Device Sync',
    },
    {
      icon: Headphones,
      iconColor: 'text-rose-400',
      iconBg: 'bg-rose-500/10 border-rose-500/30',
      badge: 'Audio Dual-Track',
      title: 'Instant Sub & Dub Toggle',
      description:
        'Switch between Japanese audio with styled soft subtitles and crystal-clear English Dub with a single touch—without restarting the player.',
      highlight: 'Zero Buffering Delay',
    },
    {
      icon: BatteryCharging,
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/10 border-amber-500/30',
      badge: 'Efficiency',
      title: '40% Less Battery Consumption',
      description:
        'Built on the new Hermes JavaScript engine and native video pipelines to minimize CPU throttling and keep your device cool during marathon anime sessions.',
      highlight: 'Battery Optimized',
    },
  ]

  return (
    <section id="features" className="py-10 sm:py-16 lg:py-20 relative overflow-hidden bg-[#08090D]">
      {/* Background Ambience */}
      <div className="absolute top-1/2 left-0 w-80 h-80 bg-[#FF2B3C]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#38BDF8]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-2.5 sm:space-y-4 mb-6 sm:mb-12">
          <Badge variant="default" className="text-xs">
            Engineered Beyond Ordinary
          </Badge>
          <h2 className="font-display text-2xl xs:text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Built from Scratch for the{' '}
            <span className="text-gradient-crimson">Ultimate Anime Experience</span>
          </h2>
          <p className="text-xs sm:text-base text-slate-400 leading-relaxed">
            Most streaming apps are clunky web views wrapped in bloatware. AnimeHub is crafted as a high-performance native Android application delivering streams in the highest quality possible.
          </p>
        </div>

        {/* Mobile Horizontal Swipe Indicator */}
        <div className="flex md:hidden items-center justify-between text-[11px] text-slate-400 mb-3 px-0.5">
          <span className="flex items-center gap-1.5 font-medium text-slate-300">
            <Sparkles className="size-3.5 text-[#FF2B3C]" />
            Swipe horizontally for features
          </span>
          <span className="font-mono text-[10px] text-slate-500">6 features &rarr;</span>
        </div>

        {/* Feature Grid: Mobile Horizontal Carousel | Desktop 3-Col Grid */}
        <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6 lg:gap-8 md:overflow-visible md:pb-0">
          {features.map((feature, idx) => {
            const Icon = feature.icon
            return (
              <Card
                key={idx}
                className="w-[80vw] max-w-[310px] shrink-0 snap-center md:w-auto group relative overflow-hidden bg-[#10121A]/80 border border-white/10 hover:border-[#FF2B3C]/40 transition-all duration-300 hover:shadow-2xl hover:shadow-[#FF2B3C]/10 flex flex-col justify-between"
              >
                {/* Neon Accent Stripe on Top */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#FF2B3C]/0 to-transparent group-hover:via-[#FF2B3C] transition-all duration-500" />

                <CardHeader className="p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`size-11 sm:size-12 rounded-2xl flex items-center justify-center border ${feature.iconBg} ${feature.iconColor} group-hover:scale-110 transition-transform duration-300 shrink-0`}
                    >
                      <Icon className="size-5 sm:size-6" />
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-mono text-slate-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                      {feature.badge}
                    </span>
                  </div>

                  <CardTitle className="group-hover:text-[#FF4252] transition-colors text-lg sm:text-xl">
                    {feature.title}
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="px-5 sm:px-6 pb-5 sm:pb-6 pt-0">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 pt-2 border-t border-white/5">
                    <Sparkles className="size-3.5 text-[#FF2B3C] shrink-0" />
                    <span>{feature.highlight}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
