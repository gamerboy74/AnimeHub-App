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
    <section id="install" className="py-24 relative overflow-hidden bg-[#0A0D13]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
          <Badge variant="default" className="text-xs">
            Simple 3-Step Setup
          </Badge>
          <h2 className="font-display text-3xl sm:text-5xl font-black text-white tracking-tight">
            How to Install <span className="text-gradient-crimson">AnimeHub APK</span>
          </h2>
          <p className="text-sm sm:text-base text-slate-400">
            Installing an Android APK takes less than 60 seconds. Follow these quick steps to start streaming immediately.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {steps.map((item, idx) => {
            const Icon = item.icon
            return (
              <div
                key={idx}
                className="relative rounded-3xl bg-[#10121A] border border-white/10 p-8 flex flex-col justify-between hover:border-[#FF2B3C]/40 transition-all duration-300 group shadow-xl"
              >
                {/* Step Number Background */}
                <div className="absolute top-4 right-6 font-display font-black text-5xl text-white/[0.04] group-hover:text-[#FF2B3C]/10 transition-colors select-none">
                  {item.step}
                </div>

                <div>
                  <div className="size-12 rounded-2xl bg-[#FF2B3C]/10 border border-[#FF2B3C]/25 flex items-center justify-center text-[#FF2B3C] mb-6 group-hover:scale-110 transition-transform">
                    <Icon className="size-6" />
                  </div>

                  <span className="text-xs font-mono font-bold text-[#FF6B7A] tracking-wider uppercase mb-1 block">
                    {item.badge}
                  </span>
                  <h3 className="font-display text-xl font-bold text-white mb-3">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-white/5 flex items-center text-xs font-semibold text-slate-300">
                  <span>Fast Setup</span>
                  <ArrowRight className="size-3.5 ml-2 text-[#FF2B3C] group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            )
          })}
        </div>

        {/* Big Banner CTA */}
        <div className="rounded-3xl bg-gradient-to-r from-[#FF2B3C]/20 via-[#FF4757]/15 to-[#38BDF8]/15 border border-[#FF2B3C]/30 p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="font-display text-2xl sm:text-3xl font-black text-white">
              Ready to Upgrade Your Anime Streaming?
            </h3>
            <p className="text-sm text-slate-300 max-w-xl">
              Download AnimeHub APK {APP_CONFIG.version} for Android. Compatible with Android 7.0 and up (including Android 14+).
            </p>
          </div>

          <Button
            size="lg"
            variant="glow"
            onClick={onOpenDownload}
            className="gap-3 font-bold text-base px-8 shrink-0 shadow-xl shadow-[#FF2B3C]/40"
          >
            <Download className="size-5" />
            <span>Download APK Now</span>
          </Button>
        </div>
      </div>
    </section>
  )
}
