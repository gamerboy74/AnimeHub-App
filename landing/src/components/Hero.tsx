import React from 'react'
import {
  Download,
  QrCode,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Tv,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PhoneMockup } from './PhoneMockup'
import { APP_CONFIG } from '@/config/download'
import confetti from 'canvas-confetti'

interface HeroProps {
  onOpenDownload: (tab?: 'download' | 'qr' | 'guide') => void
}

export function Hero({ onOpenDownload }: HeroProps) {
  const handleDirectDownload = () => {
    confetti({
      particleCount: 90,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FF2B3C', '#FF4757', '#38BDF8', '#FFFFFF'],
    })
    onOpenDownload('download')
  }

  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden bg-cyber-grid">
      {/* Background Lighting Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[900px] h-[500px] bg-radial-gradient pointer-events-none" />
      <div className="absolute top-20 right-10 w-96 h-96 bg-[#FF2B3C]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-[#38BDF8]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Copy & CTAs */}
          <div className="lg:col-span-7 flex flex-col items-start text-left space-y-6">
            {/* Version Announcement Pill with Real App Icon */}
            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#10121A] border border-[rgba(255,43,60,0.3)] backdrop-blur-md shadow-sm">
              <img
                src="/icon.png"
                alt="AnimeHub App"
                className="size-5 rounded-md object-cover"
              />
              <span className="text-xs font-semibold text-slate-200">
                Official Android {APP_CONFIG.version} Release
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-[11px] font-mono text-[#38BDF8]">Hermes 60 FPS</span>
            </div>

            {/* Headline with "Highest Quality Possible" */}
            <h1 className="font-display text-4xl sm:text-6xl lg:text-6xl font-black tracking-tight leading-[1.08] text-white">
              Stream 10,000+ Anime in{' '}
              <span className="text-gradient-crimson underline decoration-[#FF2B3C]/40 underline-offset-8">
                the Highest Quality Possible
              </span>
              . Zero Ads. Pure Art.
            </h1>

            {/* Sub-headline */}
            <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed max-w-2xl">
              Engineered natively for Android. Experience butter-smooth 1080p FHD video playback at the highest quality possible, instant sub &amp; dub switching, smart offline caching, and real-time watchlist sync.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2 w-full sm:w-auto">
              <Button
                variant="glow"
                size="lg"
                onClick={handleDirectDownload}
                className="gap-3 text-base font-bold shadow-xl shadow-[#FF2B3C]/30 w-full sm:w-auto"
              >
                <Download className="size-5" />
                <span>Download APK ({APP_CONFIG.version})</span>
                <span className="text-xs font-mono bg-black/30 px-2 py-0.5 rounded-full text-white/90">
                  {APP_CONFIG.apkSize}
                </span>
              </Button>

              <Button
                variant="secondary"
                size="lg"
                onClick={() => onOpenDownload('qr')}
                className="gap-2.5 text-slate-200 hover:text-white border-white/15 w-full sm:w-auto"
              >
                <QrCode className="size-5 text-[#38BDF8]" />
                <span>Scan QR on Phone</span>
              </Button>
            </div>

            {/* Trust and Safety Badges */}
            <div className="pt-4 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-[#00E676]" />
                <span>100% Free &amp; Open Source</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="size-4 text-[#FF2B3C]" />
                <span>0 Popups or Video Ads</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-[#38BDF8]" />
                <span>Clean &amp; Signed APK</span>
              </div>
            </div>

            {/* Stats Metrics Grid */}
            <div className="grid grid-cols-3 gap-4 pt-6 w-full border-t border-white/10 max-w-lg">
              <div className="flex flex-col">
                <span className="font-display font-black text-2xl sm:text-3xl text-white">
                  10,000<span className="text-[#FF2B3C]">+</span>
                </span>
                <span className="text-xs text-slate-400 mt-0.5">Anime Episodes</span>
              </div>
              <div className="flex flex-col">
                <span className="font-display font-black text-2xl sm:text-3xl text-white">
                  1080<span className="text-[#38BDF8]">p</span>
                </span>
                <span className="text-xs text-slate-400 mt-0.5">Highest Quality</span>
              </div>
              <div className="flex flex-col">
                <span className="font-display font-black text-2xl sm:text-3xl text-white">
                  60 <span className="text-[#00E676]">FPS</span>
                </span>
                <span className="text-xs text-slate-400 mt-0.5">Hermes Engine</span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Phone Mockup */}
          <div className="lg:col-span-5 flex justify-center items-center">
            <PhoneMockup />
          </div>
        </div>
      </div>
    </section>
  )
}
