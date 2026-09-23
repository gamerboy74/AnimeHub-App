import React from 'react'
import { Download, Settings, Play, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { APP_CONFIG } from '@/config/download'

interface InstallationGuideProps {
  onOpenDownload: () => void
}

export function InstallationGuide({ onOpenDownload }: InstallationGuideProps) {
  const steps = [
    {
      step: '01',
      icon: Download,
      title: 'Download AnimeHub APK',
      desc: `Tap the Download APK button to download the official ${APP_CONFIG.version} signed package (~${APP_CONFIG.apkSize}) directly to your Android device.`,
      badge: 'Step 1',
    },
    {
      step: '02',
      icon: Settings,
      title: 'Enable Unknown Sources',
      desc: 'When prompted by your browser or Android system, allow installation from this source. AnimeHub is 100% verified and contains zero harmful code.',
      badge: 'Step 2',
    },
    {
      step: '03',
      icon: Play,
      title: 'Launch & Enjoy',
      desc: 'Tap Install, open the app, sign in or explore as guest, and immerse yourself in 10,000+ anime titles in the highest quality possible.',
      badge: 'Step 3',
    },
  ]

  return (
    <section id="install" className="py-10 sm:py-16 lg:py-20 relative overflow-hidden bg-[#0A0D13]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-2xl mx-auto space-y-2.5 sm:space-y-4 mb-6 sm:mb-14">
          <Badge variant="default" className="text-xs">
            Simple 3-Step Setup
          </Badge>
          <h2 className="font-display text-2xl xs:text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            How to Install <span className="text-gradient-crimson">AnimeHub APK</span>
          </h2>
          <p className="text-xs sm:text-base text-slate-400 leading-relaxed">
            Installing an Android APK takes less than 60 seconds. Follow these quick steps to start streaming immediately.
          </p>
        </div>

        {/* Mobile Connected Stepper (block md:hidden) */}
        <div className="block md:hidden bg-[#10121A] border border-white/10 rounded-2xl p-4 space-y-3.5 mb-6">
          {steps.map((item, idx) => {
            const Icon = item.icon
            return (
              <div key={idx} className="flex items-start gap-3">
                <div className="size-8 rounded-xl bg-[#FF2B3C]/10 border border-[#FF2B3C]/30 flex items-center justify-center text-[#FF2B3C] shrink-0">
                  <Icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-mono text-[10px] text-[#FF6B7A] font-bold uppercase">{item.badge}:</span>
                    <span className="font-display font-bold text-white text-xs xs:text-sm">{item.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Desktop Steps Grid (hidden on mobile, grid on md+) */}
        <div className="hidden md:grid md:grid-cols-3 gap-5 sm:gap-8 mb-10 sm:mb-12">
          {steps.map((item, idx) => {
            const Icon = item.icon
            return (
              <div
                key={idx}
                className="relative rounded-3xl bg-[#10121A] border border-white/10 p-6 sm:p-8 flex flex-col justify-between hover:border-[#FF2B3C]/40 transition-all duration-300 group shadow-xl"
              >
                {/* Step Number Background */}
                <div className="absolute top-4 right-6 font-display font-black text-4xl sm:text-5xl text-white/[0.04] group-hover:text-[#FF2B3C]/10 transition-colors select-none">
                  {item.step}
                </div>

                <div>
                  <div className="size-11 sm:size-12 rounded-2xl bg-[#FF2B3C]/10 border border-[#FF2B3C]/25 flex items-center justify-center text-[#FF2B3C] mb-5 sm:mb-6 group-hover:scale-110 transition-transform">
                    <Icon className="size-5 sm:size-6" />
                  </div>

                  <span className="text-[11px] sm:text-xs font-mono font-bold text-[#FF6B7A] tracking-wider uppercase mb-1 block">
                    {item.badge}
                  </span>
                  <h3 className="font-display text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <div className="pt-5 sm:pt-6 mt-5 sm:mt-6 border-t border-white/5 flex items-center text-xs font-semibold text-slate-300">
                  <span>Fast Setup</span>
                  <ArrowRight className="size-3.5 ml-2 text-[#FF2B3C] group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            )
          })}
        </div>

        {/* Big Banner CTA */}
        <div className="rounded-3xl bg-gradient-to-r from-[#FF2B3C]/20 via-[#FF4757]/15 to-[#38BDF8]/15 border border-[#FF2B3C]/30 p-6 sm:p-10 lg:p-12 flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8 shadow-2xl">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="font-display text-xl xs:text-2xl sm:text-3xl font-black text-white leading-tight">
              Ready to Upgrade Your Anime Streaming?
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              Download AnimeHub APK {APP_CONFIG.version} for Android. Compatible with Android 7.0 and up (including Android 14+).
            </p>
          </div>

          <Button
            size="lg"
            variant="glow"
            onClick={onOpenDownload}
            className="w-full md:w-auto gap-2.5 font-bold text-sm sm:text-base px-6 sm:px-8 py-3.5 h-auto min-h-[48px] shrink-0 shadow-xl shadow-[#FF2B3C]/40 justify-center"
          >
            <Download className="size-5 shrink-0" />
            <span>Download APK Now</span>
          </Button>
        </div>
      </div>
    </section>
  )
}
