import React, { useState, useEffect } from 'react'
import { Download, Menu, X, ExternalLink } from 'lucide-react'
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
        scrolled
          ? 'bg-[#08090D]/90 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/40 py-3'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand Logo with Real App Icon */}
        <a href="#" className="flex items-center gap-3 group">
          <div className="relative size-11 rounded-2xl overflow-hidden p-0.5 bg-gradient-to-tr from-[#FF2B3C] to-[#FF4757] shadow-lg shadow-[#FF2B3C]/30 group-hover:shadow-[#FF2B3C]/60 transition-all">
            <img
              src="/icon.png"
              alt="AnimeHub Official Icon"
              className="w-full h-full object-cover rounded-[14px]"
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-display text-xl font-black tracking-tight text-white group-hover:text-[#FF4252] transition-colors">
                Anime<span className="text-[#FF2B3C]">Hub</span>
              </span>
              <Badge variant="default" className="text-[10px] px-2 py-0">
                {APP_CONFIG.version}
              </Badge>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Mobile for Android</span>
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
          className="md:hidden size-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0E1117] border-b border-white/10 px-6 py-5 flex flex-col gap-4 animate-in slide-in-from-top-4 duration-200">
          <a
            href="#screens"
            onClick={() => setMobileMenuOpen(false)}
            className="text-base font-semibold text-slate-200 hover:text-[#FF2B3C]"
          >
            App Views
          </a>
          <a
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
            className="text-base font-semibold text-slate-200 hover:text-[#FF2B3C]"
          >
            Features
          </a>
          <a
            href="#showcase"
            onClick={() => setMobileMenuOpen(false)}
            className="text-base font-semibold text-slate-200 hover:text-[#FF2B3C]"
          >
            Showcase
          </a>
          <a
            href="#architecture"
            onClick={() => setMobileMenuOpen(false)}
            className="text-base font-semibold text-slate-200 hover:text-[#FF2B3C]"
          >
            Tech Specs
          </a>
          <a
            href="#install"
            onClick={() => setMobileMenuOpen(false)}
            className="text-base font-semibold text-slate-200 hover:text-[#FF2B3C]"
          >
            Installation
          </a>
          <a
            href="#faq"
            onClick={() => setMobileMenuOpen(false)}
            className="text-base font-semibold text-slate-200 hover:text-[#FF2B3C]"
          >
            FAQ
          </a>
          <div className="pt-2 flex flex-col gap-3">
            <Button
              variant="glow"
              size="lg"
              onClick={() => {
                setMobileMenuOpen(false)
                onOpenDownload()
              }}
              className="w-full gap-2 font-bold"
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
