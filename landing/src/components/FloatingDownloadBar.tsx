import React, { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { APP_CONFIG } from '@/config/download'

interface FloatingDownloadBarProps {
  onOpenDownload: () => void
}

export function FloatingDownloadBar({ onOpenDownload }: FloatingDownloadBarProps) {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      if (!dismissed) {
        setVisible(window.scrollY > 450)
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [dismissed])

  if (!visible || dismissed) return null

  return (
    <div className="fixed bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-xl animate-in slide-in-from-bottom-6 duration-300">
      <div className="rounded-2xl bg-[#10121A]/95 backdrop-blur-2xl border border-[rgba(255,43,60,0.35)] p-2.5 sm:px-5 sm:py-3 shadow-2xl shadow-black/80 flex items-center justify-between gap-2.5 sm:gap-3 ring-1 ring-white/10">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <img
            src="/icon.png"
            alt="AnimeHub App Icon"
            className="size-9 sm:size-11 rounded-xl object-cover shrink-0 shadow-md shadow-[#FF2B3C]/40 border border-[#FF2B3C]/30"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-display font-bold text-xs sm:text-sm text-white truncate">
                AnimeHub APK
              </span>
              <span className="text-[9px] sm:text-[10px] font-mono text-[#38BDF8] bg-[#38BDF8]/10 px-1.5 py-0.2 rounded border border-[#38BDF8]/20 shrink-0">
                {APP_CONFIG.version}
              </span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-[#9DA4B4] truncate">
              Android 7.0+ · {APP_CONFIG.apkSize} · Free
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            variant="glow"
            onClick={onOpenDownload}
            className="gap-1.5 shrink-0 font-bold text-xs px-3 sm:px-4 h-8 sm:h-9 shadow-lg shadow-[#FF2B3C]/30"
          >
            <Download className="size-3 sm:size-3.5 shrink-0" />
            <span>Download</span>
          </Button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="size-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
            aria-label="Dismiss download bar"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
