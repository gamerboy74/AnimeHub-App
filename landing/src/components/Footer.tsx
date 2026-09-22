import React from 'react'
import { ArrowUp, ExternalLink } from 'lucide-react'
import { APP_CONFIG } from '@/config/download'

export function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <footer className="border-t border-white/10 bg-[#06070A] py-16 text-slate-400 text-xs sm:text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand Col with Real App Icon */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <img
                src="/icon.png"
                alt="AnimeHub Icon"
                className="size-10 rounded-xl object-cover shadow-md shadow-[#FF2B3C]/30 border border-[#FF2B3C]/30"
              />
              <span className="font-display text-xl font-black text-white tracking-tight">
                Anime<span className="text-[#FF2B3C]">Hub</span>
              </span>
              <span className="text-[11px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                {APP_CONFIG.version} Mobile
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-md leading-relaxed">
              The premier ad-free anime streaming experience on Android. Engineered with native Hermes bytecode, hardware-accelerated video decoding, and streams delivered at the highest quality possible.
            </p>
            <div className="text-[11px] text-slate-500">
              Disclaimer: AnimeHub does not host media files on its servers. All streams are retrieved via third-party APIs.
            </div>
          </div>

          {/* Links 1 */}
          <div className="space-y-3">
            <h4 className="font-display font-bold text-white text-xs uppercase tracking-wider">
              Navigation
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  App Features
                </a>
              </li>
              <li>
                <a href="#showcase" className="hover:text-white transition-colors">
                  Featured Anime
                </a>
              </li>
              <li>
                <a href="#architecture" className="hover:text-white transition-colors">
                  Hermes Architecture
                </a>
              </li>
              <li>
                <a href="#install" className="hover:text-white transition-colors">
                  Installation Guide
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">
                  FAQ &amp; Safety
                </a>
              </li>
            </ul>
          </div>

          {/* Links 2 */}
          <div className="space-y-3">
            <h4 className="font-display font-bold text-white text-xs uppercase tracking-wider">
              Ecosystem
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <span className="text-slate-500">iOS (Coming Soon)</span>
              </li>
              <li>
                <span className="text-slate-500">Android TV (In Review)</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            &copy; {new Date().getFullYear()} AnimeHub Team. Crafted for anime lovers worldwide.
          </div>

          <button
            onClick={scrollToTop}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
          >
            <span>Back to top</span>
            <ArrowUp className="size-3.5" />
          </button>
        </div>
      </div>
    </footer>
  )
}
