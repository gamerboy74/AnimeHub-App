import React, { useState, useEffect } from 'react'
import {
  Download,
  Copy,
  Check,
  ShieldCheck,
  FileCheck,
  AlertCircle,
  FolderOpen,
} from 'lucide-react'
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { APP_CONFIG } from '@/config/download'
import confetti from 'canvas-confetti'
import QRCode from 'qrcode'

interface DownloadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTab?: 'download' | 'qr' | 'guide'
}

export function DownloadModal({ open, onOpenChange, initialTab = 'download' }: DownloadModalProps) {
  const [copied, setCopied] = useState(false)
  const [urlCopied, setUrlCopied] = useState(false)
  const [tab, setTab] = useState<'download' | 'qr' | 'guide'>(initialTab)
  const [qrTarget, setQrTarget] = useState<'expo' | 'dashboard' | 'website'>('expo')
  const [qrDataUrl, setQrDataUrl] = useState<string>('')

  // Determine actual scannable URLs
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://anime-hub-mocha.vercel.app'
  
  // Official Expo Cloud CDN APK
  const expoUrl = APP_CONFIG.apkDownloadUrl

  // EAS Build Dashboard URL
  const dashboardUrl = APP_CONFIG.expoBuildDashboardUrl

  // Web portal URL
  const siteUrl = origin

  const activeDownloadUrl =
    qrTarget === 'expo' ? expoUrl : qrTarget === 'dashboard' ? dashboardUrl : siteUrl

  useEffect(() => {
    if (open && initialTab) {
      setTab(initialTab)
    }
  }, [open, initialTab])

  // Generate genuine scannable QR code whenever target URL changes
  useEffect(() => {
    let isMounted = true
    QRCode.toDataURL(activeDownloadUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 320,
      color: {
        dark: '#08090D',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (isMounted) setQrDataUrl(url)
      })
      .catch((err) => {
        console.error('Failed to generate QR code:', err)
      })

    return () => {
      isMounted = false
    }
  }, [activeDownloadUrl])

  const handleCopyHash = () => {
    navigator.clipboard.writeText(APP_CONFIG.sha256)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(activeDownloadUrl)
    setUrlCopied(true)
    setTimeout(() => setUrlCopied(false), 2000)
  }

  const triggerDownload = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FF2B3C', '#FF4757', '#38BDF8', '#FFFFFF'],
    })

    // Direct APK download link
    const link = document.createElement('a')
    link.href = APP_CONFIG.apkDownloadUrl
    link.download = APP_CONFIG.apkFilename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="default" className="text-[11px]">
            Official Android Release
          </Badge>
          <Badge variant="neon" className="text-[11px]">
            {APP_CONFIG.version} Stable
          </Badge>
        </div>
        <DialogTitle>Download AnimeHub for Android</DialogTitle>
        <DialogDescription>
          Get direct access to 10,000+ anime titles in the highest quality possible with adaptive HLS streaming and offline playback.
        </DialogDescription>
      </DialogHeader>

      {/* Tabs */}
      <div className="grid grid-cols-3 rounded-xl bg-white/5 p-1 border border-white/10 mb-5 gap-1">
        <button
          onClick={() => setTab('download')}
          className={`py-2 px-1 text-center text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
            tab === 'download'
              ? 'bg-[#FF2B3C] text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Download className="size-3.5 hidden xs:inline" />
          <span><span className="hidden sm:inline">Direct </span>Download</span>
        </button>
        <button
          onClick={() => setTab('qr')}
          className={`py-2 px-1 text-center text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
            tab === 'qr'
              ? 'bg-[#FF2B3C] text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileCheck className="size-3.5 hidden xs:inline" />
          <span>QR Code</span>
        </button>
        <button
          onClick={() => setTab('guide')}
          className={`py-2 px-1 text-center text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
            tab === 'guide'
              ? 'bg-[#FF2B3C] text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FolderOpen className="size-3.5 hidden xs:inline" />
          <span>Guide</span>
        </button>
      </div>

      {/* Tab 1: Direct Download */}
      {tab === 'download' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#10121A] p-3.5 sm:p-4 border border-white/10 flex flex-col xs:flex-row xs:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src="/icon.png"
                alt="AnimeHub App Icon"
                className="size-11 sm:size-12 rounded-xl object-cover border border-[#FF2B3C]/30 shadow-md shadow-[#FF2B3C]/30 shrink-0"
              />
              <div className="min-w-0">
                <div className="font-bold text-white text-sm truncate">{APP_CONFIG.apkFilename}</div>
                <div className="text-xs text-slate-400">
                  {APP_CONFIG.minAndroid} · {APP_CONFIG.apkSize}
                </div>
              </div>
            </div>
            <Badge variant="success" className="self-start xs:self-auto shrink-0">Verified Clean</Badge>
          </div>

          <Button
            size="lg"
            variant="glow"
            onClick={triggerDownload}
            className="w-full gap-2 text-sm sm:text-base font-bold shadow-lg shadow-[#FF2B3C]/30 py-3 sm:py-4 h-auto min-h-[48px] whitespace-normal text-center"
          >
            <Download className="size-5 shrink-0" />
            <span>Download APK Now ({APP_CONFIG.apkSize})</span>
          </Button>

          {/* Verification Hash */}
          <div className="rounded-xl bg-black/40 p-3 border border-white/5 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <FileCheck className="size-3.5 text-slate-400 shrink-0" />
                <span>SHA-256 Checksum:</span>
              </span>
              <button
                onClick={handleCopyHash}
                className="text-[11px] text-[#FF2B3C] hover:text-[#FF4252] flex items-center gap-1 font-semibold shrink-0"
              >
                {copied ? <Check className="size-3 text-[#00E676]" /> : <Copy className="size-3" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
            <div className="font-mono text-[9px] sm:text-[10px] text-slate-400 break-all bg-white/5 p-2 rounded-lg border border-white/5 leading-relaxed">
              {APP_CONFIG.sha256}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-1 text-center">
            <ShieldCheck className="size-4 text-[#00E676] shrink-0" />
            <span>0 Malware, 0 Trackers, Signed by AnimeHub</span>
          </div>
        </div>
      )}

      {/* Tab 2: Scan QR Code */}
      {tab === 'qr' && (
        <div className="flex flex-col items-center justify-center p-1 sm:p-2 space-y-4 animate-in fade-in duration-200">
          {/* Target URL Selector */}
          <div className="w-full space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Select Download Mirror for QR:</span>
              <button
                onClick={handleCopyUrl}
                className="text-[11px] text-[#FF2B3C] hover:text-[#FF4757] flex items-center gap-1 font-semibold shrink-0"
              >
                {urlCopied ? <Check className="size-3 text-[#00E676]" /> : <Copy className="size-3" />}
                <span>{urlCopied ? 'Copied!' : 'Copy URL'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 xs:grid-cols-3 gap-1.5 sm:gap-2 text-xs">
              <button
                type="button"
                onClick={() => setQrTarget('expo')}
                className={`p-2 rounded-xl border text-left transition-all ${
                  qrTarget === 'expo'
                    ? 'bg-[#FF2B3C]/15 border-[#FF2B3C] text-white'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold text-[11px] flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-[#00E676]" />
                  EAS Cloud CDN
                </div>
                <div className="text-[9px] text-slate-400 truncate mt-0.5 font-mono">
                  Official Expo Cloud
                </div>
              </button>

              <button
                type="button"
                onClick={() => setQrTarget('dashboard')}
                className={`p-2 rounded-xl border text-left transition-all ${
                  qrTarget === 'dashboard'
                    ? 'bg-[#FF2B3C]/15 border-[#FF2B3C] text-white'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold text-[11px] flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-[#38BDF8]" />
                  Build Verify
                </div>
                <div className="text-[9px] text-slate-400 truncate mt-0.5 font-mono">
                  Expo Dashboard
                </div>
              </button>

              <button
                type="button"
                onClick={() => setQrTarget('website')}
                className={`p-2 rounded-xl border text-left transition-all ${
                  qrTarget === 'website'
                    ? 'bg-[#FF2B3C]/15 border-[#FF2B3C] text-white'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold text-[11px] flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-[#A855F7]" />
                  Web Portal
                </div>
                <div className="text-[9px] text-slate-400 truncate mt-0.5 font-mono">
                  {siteUrl}
                </div>
              </button>
            </div>
          </div>

          {/* Genuine Scannable QR Code Canvas */}
          <div className="relative p-2.5 sm:p-3 rounded-2xl bg-white text-black shadow-2xl shadow-black/80 border-4 border-[#FF2B3C]/40 group">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="AnimeHub APK Download QR Code"
                className="size-44 sm:size-52 rounded-lg object-contain"
              />
            ) : (
              <div className="size-44 sm:size-52 flex items-center justify-center text-xs text-slate-500 font-mono">
                Generating QR...
              </div>
            )}

            {/* Centered App Icon Badge */}
            <div className="absolute inset-0 m-auto size-11 sm:size-12 rounded-xl bg-white p-1 shadow-lg border-2 border-[#FF2B3C] flex items-center justify-center pointer-events-none">
              <img
                src="/icon.png"
                alt="AnimeHub Icon"
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
          </div>

          {/* Helper details */}
          <div className="text-center space-y-1.5 w-full">
            <h4 className="text-xs sm:text-sm font-bold text-white flex items-center justify-center gap-1.5">
              <span>Scan with your Phone Camera or Google Lens</span>
            </h4>
            <p className="text-[10px] sm:text-xs text-slate-400 max-w-xs mx-auto font-mono break-all bg-black/40 px-2.5 py-1 rounded-lg border border-white/5">
              {activeDownloadUrl}
            </p>
            <p className="text-[11px] text-slate-400">
              Automatically triggers direct download of <strong className="text-white">{APP_CONFIG.apkFilename}</strong> ({APP_CONFIG.apkSize}).
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col xs:flex-row items-center gap-2 w-full pt-1">
            <a
              href={qrDataUrl}
              download="animehub-apk-qr.png"
              className="w-full xs:flex-1 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex items-center justify-center gap-1.5 border border-white/10 transition-colors"
            >
              <Download className="size-3.5" />
              <span>Save QR Image</span>
            </a>
            <a
              href={activeDownloadUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full xs:flex-1 py-2.5 px-3 rounded-xl bg-[#FF2B3C] hover:bg-[#FF4757] text-xs font-bold text-white flex items-center justify-center gap-1.5 shadow-md shadow-[#FF2B3C]/30 transition-colors"
            >
              <FileCheck className="size-3.5" />
              <span>Open in Browser</span>
            </a>
          </div>
        </div>
      )}

      {/* Tab 3: Step-by-Step Installation Guide */}
      {tab === 'guide' && (
        <div className="space-y-3">
          <div className="rounded-xl bg-[#10121A] p-3.5 border border-white/10 flex items-start gap-3">
            <div className="size-7 rounded-lg bg-[#FF2B3C] text-white flex items-center justify-center font-bold text-xs shrink-0">
              1
            </div>
            <div>
              <div className="text-xs font-bold text-white">Download the APK File</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Tap the download button to save <span className="text-[#FF2B3C]">{APP_CONFIG.apkFilename}</span> to your device.
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-[#10121A] p-3.5 border border-white/10 flex items-start gap-3">
            <div className="size-7 rounded-lg bg-[#38BDF8] text-[#08090D] flex items-center justify-center font-bold text-xs shrink-0">
              2
            </div>
            <div>
              <div className="text-xs font-bold text-white">Allow "Install Unknown Apps"</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                If prompted by Android, go to Settings &gt; Apps &gt; Chrome/Files &gt; Toggle on <span className="text-slate-200">"Allow from this source"</span>.
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-[#10121A] p-3.5 border border-white/10 flex items-start gap-3">
            <div className="size-7 rounded-lg bg-[#00E676] text-black flex items-center justify-center font-bold text-xs shrink-0">
              3
            </div>
            <div>
              <div className="text-xs font-bold text-white">Install & Stream in Highest Quality</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Tap <span className="text-white">"Install"</span>. Open AnimeHub and enjoy ad-free unlimited anime streaming!
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
            <AlertCircle className="size-4 shrink-0" />
            <span>AnimeHub is 100% safe and verified. It never requests root or sensitive device permissions.</span>
          </div>
        </div>
      )}
    </Dialog>
  )
}
