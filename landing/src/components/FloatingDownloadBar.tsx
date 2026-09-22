import React, { useState, useEffect } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { APP_CONFIG } from '@/config/download'

interface FloatingDownloadBarProps {
  onOpenDownload: () => void
}

export function FloatingDownloadBar({ onOpenDownload }: FloatingDownloadBarProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 500)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (!visible) return null

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-xl animate-in slide-in-from-bottom-6 duration-300">
      <div className="rounded-2xl bg-[#10121A]/95 backdrop-blur-2xl border border-[rgba(255,43,60,0.35)] p-3 sm:px-5 sm:py-3 shadow-2xl shadow-black/80 flex items-center justify-between gap-3 ring-1 ring-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/icon.png"
            alt="AnimeHub App Icon"
            className="size-11 rounded-xl object-cover shrink-0 shadow-md shadow-[#FF2B3C]/40 border border-[#FF2B3C]/30"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm text-white truncate">
                AnimeHub APK
              </span>
              <span className="text-[10px] font-mono text-[#38BDF8] bg-[#38BDF8]/10 px-1.5 py-0.2 rounded border border-[#38BDF8]/20">
                {APP_CONFIG.version}
              </span>
            </div>
            <div className="text-[11px] text-[#9DA4B4] truncate">
              Android 7.0+ · {APP_CONFIG.apkSize} · Free
            </div>
          </div>
        </div>

        <Button
          size="sm"
          variant="glow"
          onClick={onOpenDownload}
          className="gap-2 shrink-0 font-bold text-xs px-4 h-9 shadow-lg shadow-[#FF2B3C]/30"
        >
          <Download className="size-3.5" />
          <span>Download</span>
        </Button>
      </div>
    </div>
  )
}
