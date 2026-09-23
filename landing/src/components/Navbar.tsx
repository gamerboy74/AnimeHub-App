import React, { useState, useEffect } from 'react'
import { Download, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { APP_CONFIG } from '@/config/download'

interface NavbarProps {
  onOpenDownload: () => void
}

export function Navbar({ onOpenDownload }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled || mobileMenuOpen
          ? 'bg-[#08090D]/95 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/40 py-2.5 sm:py-3'
          : 'bg-transparent py-3 sm:py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand Logo with Real App Icon */}
        <a href="#" className="flex items-center gap-2.5 sm:gap-3 group min-w-0">
          <div className="relative size-9 sm:size-11 rounded-xl sm:rounded-2xl overflow-hidden p-0.5 bg-gradient-to-tr from-[#FF2B3C] to-[#FF4757] shadow-lg shadow-[#FF2B3C]/30 group-hover:shadow-[#FF2B3C]/60 transition-all shrink-0">
            <img
              src="/icon.png"
              alt="AnimeHub Official Icon"
              className="w-full h-full object-cover rounded-[10px] sm:rounded-[14px]"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-display text-lg sm:text-xl font-black tracking-tight text-white group-hover:text-[#FF4252] transition-colors truncate">
                Anime<span className="text-[#FF2B3C]">Hub</span>
              </span>
              <Badge variant="default" className="text-[9px] sm:text-[10px] px-1.5 py-0">
                {APP_CONFIG.version}
              </Badge>
            </div>
            <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono leading-none">Mobile for Android</span>
          </div>
        </a>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <a
            href="#screens"
            className="hover:text-white transition-colors relative hover:after:w-full after:w-0 after:h-0.5 after:bg-[#FF2B3C] after:absolute after:-bottom-1 after:left-0 after:transition-all"
          >
            App Views
          </a>
          <a
            href="#features"
            className="hover:text-white transition-colors relative hover:after:w-full after:w-0 after:h-0.5 after:bg-[#FF2B3C] after:absolute after:-bottom-1 after:left-0 after:transition-all"
          >
            Features
          </a>
          <a
            href="#showcase"
            className="hover:text-white transition-colors relative hover:after:w-full after:w-0 after:h-0.5 after:bg-[#FF2B3C] after:absolute after:-bottom-1 after:left-0 after:transition-all"
          >
            Showcase
          </a>
          <a
            href="#architecture"
            className="hover:text-white transition-colors relative hover:after:w-full after:w-0 after:h-0.5 after:bg-[#FF2B3C] after:absolute after:-bottom-1 after:left-0 after:transition-all"
          >
            Tech Specs
          </a>
          <a
            href="#install"
            className="hover:text-white transition-colors relative hover:after:w-full after:w-0 after:h-0.5 after:bg-[#FF2B3C] after:absolute after:-bottom-1 after:left-0 after:transition-all"
          >
            Installation
          </a>
          <a
            href="#faq"
            className="hover:text-white transition-colors relative hover:after:w-full after:w-0 after:h-0.5 after:bg-[#FF2B3C] after:absolute after:-bottom-1 after:left-0 after:transition-all"
          >
            FAQ
          </a>
        </nav>

        {/* Action Buttons */}
        <div className="hidden sm:flex items-center gap-3">
          <Button
            variant="glow"
            size="default"
            onClick={onOpenDownload}
            className="gap-2 font-bold shadow-md"
          >
            <Download className="size-4" />
            <span>Download APK</span>
          </Button>
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden size-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white active:scale-95 transition-transform shrink-0"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed top-full left-0 right-0 bg-[#0E1117]/95 backdrop-blur-2xl border-b border-white/10 px-5 py-5 flex flex-col gap-3.5 shadow-2xl shadow-black/90 animate-in slide-in-from-top-3 duration-200 max-h-[calc(100vh-65px)] overflow-y-auto">
          <a
            href="#screens"
            onClick={() => setMobileMenuOpen(false)}
            className="text-sm font-semibold text-slate-200 hover:text-[#FF2B3C] py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
          >
            App Views
          </a>
          <a
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
            className="text-sm font-semibold text-slate-200 hover:text-[#FF2B3C] py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
          >
            Features
          </a>
          <a
            href="#showcase"
            onClick={() => setMobileMenuOpen(false)}
            className="text-sm font-semibold text-slate-200 hover:text-[#FF2B3C] py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
          >
            Catalog Showcase
          </a>
          <a
            href="#architecture"
            onClick={() => setMobileMenuOpen(false)}
            className="text-sm font-semibold text-slate-200 hover:text-[#FF2B3C] py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
          >
            Architecture &amp; Specs
          </a>
          <a
            href="#install"
            onClick={() => setMobileMenuOpen(false)}
            className="text-sm font-semibold text-slate-200 hover:text-[#FF2B3C] py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
          >
            Installation Guide
          </a>
          <a
            href="#faq"
            onClick={() => setMobileMenuOpen(false)}
            className="text-sm font-semibold text-slate-200 hover:text-[#FF2B3C] py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
          >
            FAQ
          </a>
          <div className="pt-2 flex flex-col gap-2 border-t border-white/10">
            <Button
              variant="glow"
              size="lg"
              onClick={() => {
                setMobileMenuOpen(false)
                onOpenDownload()
              }}
              className="w-full gap-2 font-bold py-3 h-auto min-h-[46px]"
            >
              <Download className="size-4" />
              <span>Download APK ({APP_CONFIG.version})</span>
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}
