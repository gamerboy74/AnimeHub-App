import React from 'react'
import {
  Download,
  QrCode,
  ShieldCheck,
  Zap,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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
    <section className="relative pt-20 pb-8 sm:pt-28 sm:pb-16 lg:pt-36 lg:pb-24 overflow-hidden bg-cyber-grid">
      {/* Background Lighting Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[600px] lg:w-[900px] h-[350px] sm:h-[500px] bg-radial-gradient pointer-events-none" />
      <div className="absolute top-20 right-5 sm:right-10 w-60 sm:w-96 h-60 sm:h-96 bg-[#FF2B3C]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-5 sm:left-10 w-60 sm:w-96 h-60 sm:h-96 bg-[#38BDF8]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-10 items-center">
          {/* Left Column: Copy & CTAs */}
          <div className="lg:col-span-7 flex flex-col items-start text-left space-y-5 sm:space-y-6">
            {/* Version Announcement Pill with Real App Icon */}
            <div className="inline-flex items-center gap-2 sm:gap-2.5 px-3 py-1.5 rounded-full bg-[#10121A] border border-[rgba(255,43,60,0.3)] backdrop-blur-md shadow-sm max-w-full flex-wrap sm:flex-nowrap">
              <img
                src="/icon.png"
                alt="AnimeHub App"
                className="size-4 sm:size-5 rounded-md object-cover shrink-0"
              />
              <span className="text-[11px] sm:text-xs font-semibold text-slate-200 truncate">
                Official Android {APP_CONFIG.version} Release
              </span>
              <span className="text-slate-600 hidden xs:inline">|</span>
              <span className="text-[10px] sm:text-[11px] font-mono text-[#38BDF8] shrink-0">Hermes 60 FPS</span>
            </div>

            {/* Headline with "Highest Quality Possible" */}
            <h1 className="font-display text-3xl xs:text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.12] text-white">
              Stream 10,000+ Anime in{' '}
              <span className="text-gradient-crimson underline decoration-[#FF2B3C]/40 underline-offset-4 sm:underline-offset-8">
                the Highest Quality Possible
              </span>
              . Zero Ads. Pure Art.
            </h1>

            {/* Sub-headline */}
            <p className="text-sm sm:text-base lg:text-lg text-slate-300 font-normal leading-relaxed max-w-2xl">
              Engineered natively for Android. Experience butter-smooth 1080p FHD video playback at the highest quality possible, instant sub &amp; dub switching, smart offline caching, and real-time watchlist sync.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1 w-full sm:w-auto">
              <Button
                variant="glow"
                size="lg"
                onClick={handleDirectDownload}
                className="gap-2.5 text-sm sm:text-base font-bold shadow-xl shadow-[#FF2B3C]/30 w-full sm:w-auto py-3.5 px-6 h-auto min-h-[50px] whitespace-normal text-center"
              >
                <Download className="size-5 shrink-0" />
                <span>Download APK ({APP_CONFIG.version})</span>
                <span className="text-xs font-mono bg-black/30 px-2 py-0.5 rounded-full text-white/90 shrink-0">
                  {APP_CONFIG.apkSize}
                </span>
              </Button>

              <Button
                variant="secondary"
                size="lg"
                onClick={() => onOpenDownload('qr')}
                className="gap-2 text-sm sm:text-base text-slate-200 hover:text-white border-white/15 w-full sm:w-auto py-3.5 px-6 h-auto min-h-[50px] flex items-center justify-center"
              >
                <QrCode className="size-4 sm:size-5 text-[#38BDF8] shrink-0" />
                <span>Scan QR on Phone</span>
              </Button>
            </div>

            {/* Trust and Safety Badges */}
            <div className="pt-2 flex flex-wrap items-center gap-y-2 gap-x-4 sm:gap-x-6 text-[11px] sm:text-xs text-slate-400">
              <div className="flex items-center gap-1.5 shrink-0">
                <CheckCircle2 className="size-3.5 sm:size-4 text-[#00E676]" />
                <span>100% Free &amp; Open Source</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Zap className="size-3.5 sm:size-4 text-[#FF2B3C]" />
                <span>0 Popups or Video Ads</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <ShieldCheck className="size-3.5 sm:size-4 text-[#38BDF8]" />
                <span>Clean &amp; Signed APK</span>
              </div>
            </div>

            {/* Stats Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 sm:gap-6 pt-5 w-full border-t border-white/10 max-w-lg text-center sm:text-left">
              <div className="flex flex-col">
                <span className="font-display font-black text-xl sm:text-3xl text-white">
                  10,000<span className="text-[#FF2B3C]">+</span>
                </span>
                <span className="text-[10px] sm:text-xs text-slate-400 mt-0.5 leading-tight">Anime Episodes</span>
              </div>
              <div className="flex flex-col">
                <span className="font-display font-black text-xl sm:text-3xl text-white">
                  1080<span className="text-[#38BDF8]">p</span>
                </span>
                <span className="text-[10px] sm:text-xs text-slate-400 mt-0.5 leading-tight">Highest Quality</span>
              </div>
              <div className="flex flex-col">
                <span className="font-display font-black text-xl sm:text-3xl text-white">
                  60 <span className="text-[#00E676]">FPS</span>
                </span>
                <span className="text-[10px] sm:text-xs text-slate-400 mt-0.5 leading-tight">Hermes Engine</span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Phone Mockup */}
          <div id="screens" className="lg:col-span-5 flex justify-center items-center scroll-mt-24">
            <PhoneMockup />
          </div>
        </div>
      </div>
    </section>
  )
}
