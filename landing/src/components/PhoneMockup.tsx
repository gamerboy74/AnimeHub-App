import React, { useState, useRef } from 'react'
import {
  Play,
  Sliders,
  Wifi,
  Battery,
  Home,
  Compass,
  Bookmark,
  User,
  Bell,
  Settings,
  Info,
  ChevronLeft,
  Heart,
  Film,
  Eye,
  MessageSquare,
  RotateCcw,
  RotateCw,
  Maximize2,
  Minimize2,
  Sparkles,
} from 'lucide-react'

export function PhoneMockup() {
  const [displayMode, setDisplayMode] = useState<'interactive' | 'screenshot'>('interactive')
  const [activeTab, setActiveTab] = useState<'home' | 'details' | 'player' | 'offline'>('home')
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const [isPlaying, setIsPlaying] = useState(true)
  const [activeTabSection, setActiveTabSection] = useState<'episodes' | 'reviews' | 'info'>('episodes')
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const isLandscape = orientation === 'landscape'

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    setTilt({ x: x * 12, y: -y * 12 })
  }

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 })
  }

  // Choose real Android screenshot based on active view
  const currentScreenshot =
    activeTab === 'details'
      ? '/screenshots/real-app-details.png'
      : activeTab === 'player'
      ? '/screenshots/real-app-player.png'
      : activeTab === 'offline'
      ? '/screenshots/real-app-offline.png'
      : '/screenshots/real-app-home.png'

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      {/* View Mode & Orientation Controls */}
      <div className="flex flex-col xs:flex-row items-center justify-center gap-1.5 p-1 rounded-2xl bg-[#10121A] border border-white/10 shadow-lg shadow-black/40 backdrop-blur-md w-full max-w-[340px] xs:max-w-md">
        {/* Interactive vs Real Android Capture */}
        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-black/40 border border-white/5 w-full xs:w-auto justify-center">
          <button
            type="button"
            onClick={() => setDisplayMode('interactive')}
            className={`flex-1 xs:flex-initial px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              displayMode === 'interactive'
                ? 'bg-[#FF2B3C] text-white shadow-md shadow-[#FF2B3C]/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="size-3 sm:size-3.5 shrink-0" />
            <span>Interactive</span>
          </button>
          <button
            type="button"
            onClick={() => setDisplayMode('screenshot')}
            className={`flex-1 xs:flex-initial px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              displayMode === 'screenshot'
                ? 'bg-[#FF2B3C] text-white shadow-md shadow-[#FF2B3C]/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>📱 Real App</span>
          </button>
        </div>

        {/* Orientation Toggle: Portrait vs Cinema Landscape */}
        <button
          type="button"
          onClick={() => setOrientation(isLandscape ? 'portrait' : 'landscape')}
          className="w-full xs:w-auto px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all text-slate-300 hover:text-white flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 shadow-sm shrink-0"
          title="Toggle phone orientation"
        >
          {isLandscape ? (
            <>
              <Minimize2 className="size-3 sm:size-3.5 text-[#38BDF8]" />
              <span>Portrait</span>
            </>
          ) : (
            <>
              <Maximize2 className="size-3 sm:size-3.5 text-[#38BDF8]" />
              <span>Landscape</span>
            </>
          )}
        </button>
      </div>

      {/* 3D Tilt Container */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          perspective: '1200px',
        }}
        className="relative group transition-all duration-300 ease-out flex justify-center w-full"
      >
        {/* Ambient Neon Glow behind Phone */}
        <div
          className={`absolute -inset-4 bg-gradient-to-tr from-[#FF2B3C]/35 via-[#FF4757]/20 to-[#38BDF8]/20 rounded-[52px] blur-2xl opacity-75 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${
            isLandscape ? 'max-w-[700px] mx-auto' : 'max-w-[370px] mx-auto'
          }`}
        />

        {/* Smartphone Shell (Smoothly morphs between Portrait and Landscape) */}
        <div
          style={{
            transform: `rotateY(${tilt.x}deg) rotateX(${tilt.y}deg)`,
            transformStyle: 'preserve-3d',
          }}
          className={`relative transition-all duration-500 ease-out bg-[#10121A] rounded-[42px] sm:rounded-[48px] p-2.5 sm:p-3 shadow-2xl border-4 border-slate-700/60 select-none ring-1 ring-white/10 ${
            isLandscape
              ? 'w-full max-w-[94vw] sm:max-w-[640px] md:max-w-[680px] h-[260px] xs:h-[300px] sm:h-[360px]'
              : 'w-full max-w-[305px] xs:max-w-[335px] sm:max-w-[350px] h-[620px] xs:h-[660px] sm:h-[700px]'
          }`}
        >
          {/* Glass Specular Reflection Overlay */}
          <div className="absolute top-0 left-1/4 w-1/2 h-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent pointer-events-none rounded-[44px] z-30" />

          {/* Screen Inner Canvas (Obsidian #08090D) */}
          <div className="relative w-full h-full bg-[#08090D] rounded-[38px] overflow-hidden flex flex-col text-[#F8F9FD] border border-white/5">
            {/* 1. REAL ANDROID SCREENSHOT MODE */}
            {displayMode === 'screenshot' ? (
              <div className="relative w-full h-full bg-[#08090D] overflow-hidden flex flex-col animate-in fade-in duration-200">
                <img
                  src={currentScreenshot}
                  alt="AnimeHub App running on Android"
                  className={`w-full h-full select-none ${
                    isLandscape
                      ? 'object-cover object-center'
                      : 'object-cover object-top'
                  }`}
                />
                {/* Authentic Device Badge Overlay */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/85 backdrop-blur-md border border-white/15 text-[10px] font-semibold text-white flex items-center gap-1.5 shadow-xl pointer-events-none z-20">
                  <span className="size-1.5 rounded-full bg-[#00E676] animate-pulse" />
                  <span>
                    Real Device Capture ·{' '}
                    {activeTab === 'player'
                      ? 'Player View (Lord Marksman)'
                      : activeTab === 'details'
                      ? 'Details View (Mushoku Tensei)'
                      : activeTab === 'offline'
                      ? 'Offline Library (2 Titles)'
                      : 'Home Feed'}
                  </span>
                </div>
              </div>
            ) : isLandscape ? (
              /* 2. FULLSCREEN CINEMA PLAYER (Landscape Mode) */
              <div className="relative w-full h-full bg-[#050608] flex flex-col justify-between overflow-hidden animate-in fade-in duration-200">
                {/* Video Backdrop Frame with Real Vanadis art */}
                <img
                  src="https://s4.anilist.co/file/anilistcdn/media/anime/banner/20809-Cjon1rP2AnD2.png"
                  alt="Lord Marksman and Vanadis"
                  className="absolute inset-0 w-full h-full object-cover brightness-[0.88]"
                  onError={(e) => {
                    e.currentTarget.src = '/screenshots/real-app-player.png'
                  }}
                />

                {/* Dark Vignette Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/80 pointer-events-none" />

                {/* Top HUD Controls */}
                <div className="relative z-20 flex items-center justify-between px-3 sm:px-5 pt-3 sm:pt-4">
                  {/* Left: Back & Title */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setActiveTab('details')
                        setOrientation('portrait')
                      }}
                      className="size-7 sm:size-8 rounded-full bg-black/70 backdrop-blur-md border border-white/15 flex items-center justify-center text-white hover:bg-white/20 transition-colors shadow-md shrink-0"
                    >
                      <ChevronLeft className="size-3.5 sm:size-4" />
                    </button>
                    <div className="min-w-0">
                      <div className="text-[8px] sm:text-[9px] font-bold text-[#38BDF8] uppercase tracking-wider leading-none mb-0.5 truncate">
                        LORD MARKSMAN
                      </div>
                      <div className="text-[11px] sm:text-sm font-black text-white leading-none truncate">
                        S1:E2 • Return Home
                      </div>
                    </div>
                  </div>

                  {/* Right: Time Pill & Quick Badges */}
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <div className="bg-black/80 backdrop-blur-md px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border border-white/15 font-mono text-[9px] sm:text-[10px] text-slate-300 shadow-md">
                      <span className="text-[#FF2B3C] font-bold">6:46</span> / 24:10
                    </div>
                    <button className="bg-black/70 backdrop-blur-md px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md border border-[#38BDF8]/50 text-[9px] sm:text-[10px] text-[#38BDF8] font-bold flex items-center gap-0.5">
                      <span>SUB 1</span>
                    </button>
                    <button className="hidden xs:flex bg-black/70 backdrop-blur-md px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md border border-white/15 text-[9px] sm:text-[10px] text-slate-300 items-center gap-1 hover:text-white">
                      <span>EPISODES</span>
                    </button>
                  </div>
                </div>

                {/* Center Playback Controls: [⏮ 10] [⏸ Neon Green Ring] [⏭ 10] */}
                <div className="relative z-20 flex items-center justify-center gap-6">
                  <button
                    onClick={() => {}}
                    className="size-10 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white flex flex-col items-center justify-center hover:scale-105 active:scale-95 transition-all text-[9px] font-bold shadow-lg"
                  >
                    <RotateCcw className="size-3.5" />
                    <span>10</span>
                  </button>

                  {/* Radiant Neon Green Glowing Pause Button with Red Bars */}
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="size-14 rounded-full bg-[#10121A] text-white flex items-center justify-center shadow-[0_0_35px_rgba(0,230,118,0.7)] ring-4 ring-[#00E676] hover:scale-110 active:scale-95 transition-all"
                  >
                    {isPlaying ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-5 bg-[#FF2B3C] rounded-sm" />
                        <div className="w-1.5 h-5 bg-[#FF2B3C] rounded-sm" />
                      </div>
                    ) : (
                      <Play className="size-6 fill-[#FF2B3C] text-[#FF2B3C] ml-0.5" />
                    )}
                  </button>

                  <button
                    onClick={() => {}}
                    className="size-10 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white flex flex-col items-center justify-center hover:scale-105 active:scale-95 transition-all text-[9px] font-bold shadow-lg"
                  >
                    <RotateCw className="size-3.5" />
                    <span>10</span>
                  </button>
                </div>

                {/* Bottom HUD: Scrubber & Options */}
                <div className="relative z-20 px-5 pb-3 space-y-2">
                  {/* Progress Scrubber */}
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-white font-bold">6:46</span>
                    <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-[#FF2B3C] rounded-full w-[28%]" />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">24:10</span>
                  </div>

                  {/* Bottom Options Pills */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setOrientation('portrait')}
                      className="px-2.5 py-0.5 rounded-md bg-black/70 border border-white/10 text-[9px] text-slate-300 flex items-center gap-1 hover:text-white"
                    >
                      <Minimize2 className="size-2.5" />
                      <span>Exit Cinema</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button className="px-2.5 py-1 rounded-lg bg-black/70 border border-[#38BDF8]/50 text-[#38BDF8] text-[10px] font-bold flex items-center gap-1 shadow-sm">
                        <Settings className="size-3" />
                        <span>1080p</span>
                      </button>
                      <button className="px-2.5 py-1 rounded-lg bg-black/70 border border-[#38BDF8]/50 text-[#38BDF8] text-[10px] font-bold flex items-center gap-1 shadow-sm">
                        <MessageSquare className="size-3" />
                        <span>English</span>
                      </button>
                      <button className="px-2.5 py-1 rounded-lg bg-black/70 border border-[#38BDF8]/50 text-[#38BDF8] text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                        <Sliders className="size-3" />
                        <span>SETTINGS</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* 3. PORTRAIT INTERACTIVE MODE (Home, Details, Player, Offline) */
              <>
                {/* Android Status Bar */}
                <div className="relative z-20 flex items-center justify-between px-5 pt-3 pb-1 text-[11px] font-medium text-slate-300">
                  <div className="flex items-center gap-1.5 font-sans font-semibold text-[11px]">
                    <span>1:37</span>
                    <span className="size-1 rounded-full bg-slate-500" />
                    <span className="text-[10px] text-slate-400">5G</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-slate-400">4.80 KB/s</span>
                    <Wifi className="size-3 text-slate-200" />
                    <div className="flex items-center gap-0.5 text-[10px] font-bold text-slate-200 font-mono">
                      <span>12%</span>
                      <Battery className="size-3 text-slate-200" />
                    </div>
                  </div>
                </div>

                {/* Universal Header (Only on Home Feed) */}
                {activeTab === 'home' && (
                  <div className="relative z-20 px-4 py-2 flex items-center justify-between border-b border-white/5 bg-[#08090D]/90 backdrop-blur-md">
                    {/* Hamburger Button */}
                    <button className="flex flex-col gap-1 p-1 hover:opacity-80 transition-opacity">
                      <div className="w-4 h-0.5 bg-white rounded-full" />
                      <div className="w-2.5 h-0.5 bg-[#FF2B3C] rounded-full" />
                      <div className="w-4 h-0.5 bg-white rounded-full" />
                    </button>

                    {/* Logo: Clean ANIMEHUB typography */}
                    <div className="flex items-center">
                      <span className="font-display font-black text-base tracking-wider text-white">
                        ANIME<span className="text-[#FF2B3C]">HUB</span>
                      </span>
                    </div>

                    {/* Right Icons: Bell with 23 badge + Red Settings + Megumi Avatar */}
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Bell className="size-4 text-slate-300" />
                        <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-[#FF2B3C] text-[9px] font-black text-white flex items-center justify-center">
                          23
                        </span>
                      </div>
                      <Settings className="size-4 text-[#FF2B3C]" />
                      <div className="size-7 rounded-full overflow-hidden border border-white/20 shadow-sm bg-[#1A1D28] flex items-center justify-center">
                        <img
                          src="https://s4.anilist.co/file/anilistcdn/character/large/b127993-yU9Z58F6ZqgG.png"
                          alt="Profile"
                          onError={(e) => {
                            e.currentTarget.src = '/icon.png'
                          }}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 1: HOME FEED */}
                {activeTab === 'home' && (
                  <div className="flex-1 flex flex-col justify-between p-3 overflow-y-auto animate-in fade-in duration-200">
                    {/* Hero Carousel Card: Daemons of the Shadow Realm */}
                    <div className="relative rounded-2xl overflow-hidden bg-[#10121A] border border-[rgba(255,43,60,0.25)] shadow-xl shadow-black/80 group/card">
                      <div className="absolute top-0 left-0 w-8 h-8 rounded-tl-2xl border-t-[3px] border-l-[3px] border-[#FF2B3C] pointer-events-none z-20" />

                      <div className="relative h-56 overflow-hidden bg-[#161924]">
                        <img
                          src="https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx195600-moI0UFArtOme.jpg"
                          alt="Daemons of the Shadow Realm"
                          className="w-full h-full object-cover object-top brightness-[0.9] contrast-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#10121A] via-[#10121A]/60 to-transparent" />
                      </div>

                      <div className="relative -mt-24 p-3 space-y-1.5 z-10">
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-[#FF2B3C] tracking-wider uppercase">
                          <span className="size-1.5 rounded-full bg-[#FF2B3C] animate-pulse" />
                          <span>TRENDING NOW</span>
                        </div>

                        <div>
                          <h4 className="text-base font-display font-black text-white leading-tight">
                            Daemons of the Shadow Realm
                          </h4>
                          <p className="text-[11px] text-slate-400 font-sans mt-0.5">黄泉のツガイ</p>
                        </div>

                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          <span>2026</span>
                          <span>• tv</span>
                          <span>• 24 eps</span>
                        </div>

                        <div className="flex gap-1.5 pt-0.5">
                          {['Action', 'Adventure', 'Comedy'].map((genre) => (
                            <span
                              key={genre}
                              className="text-[9px] font-medium px-2.5 py-0.5 rounded-full bg-[#1B1E2B] text-slate-300 border border-white/5"
                            >
                              {genre}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center gap-2 pt-1.5">
                          <button
                            onClick={() => {
                              setActiveTab('player')
                              setOrientation('landscape')
                            }}
                            className="flex-1 h-8 rounded-xl bg-[#FF2B3C] hover:bg-[#FF4757] text-white font-black text-[11px] flex items-center justify-center gap-1.5 shadow-md shadow-[#FF2B3C]/40 transition-colors"
                          >
                            <Play className="size-3 fill-current ml-0.5" />
                            <span>PLAY NOW</span>
                          </button>
                          <button
                            onClick={() => setActiveTab('details')}
                            className="flex-1 h-8 rounded-xl bg-transparent hover:bg-[#FF2B3C]/10 text-[#FF2B3C] text-[11px] font-bold flex items-center justify-center gap-1 border border-[#FF2B3C] transition-colors"
                          >
                            <Info className="size-3" />
                            <span>DETAILS</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Pagination Dots */}
                    <div className="flex items-center justify-center gap-1.5 py-1.5">
                      <span className="size-1.5 rounded-full bg-slate-600" />
                      <span className="w-5 h-1.5 rounded-full bg-[#FF2B3C] shadow-sm shadow-[#FF2B3C]" />
                      <span className="size-1.5 rounded-full bg-slate-600" />
                      <span className="size-1.5 rounded-full bg-slate-600" />
                      <span className="size-1.5 rounded-full bg-slate-600" />
                    </div>

                    {/* Continue Watching Section */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[9px] font-black text-[#FF2B3C] tracking-wider uppercase">
                            RESUME PLAYBACK
                          </div>
                          <div className="text-xs font-bold text-white">Continue Watching</div>
                        </div>
                        <span className="text-[10px] text-slate-400 font-semibold tracking-wide">
                          VIEW ALL →
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <div
                          onClick={() => {
                            setActiveTab('details')
                          }}
                          className="flex-1 rounded-xl overflow-hidden bg-[#10121A] border border-white/10 group relative cursor-pointer"
                        >
                          <div className="relative h-20 bg-slate-800 overflow-hidden">
                            <img
                              src="https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx178789-hNXjKFzUq7mk.jpg"
                              alt="Mushoku Tensei S3"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 m-auto size-7 rounded-full bg-[#FF2B3C] text-white flex items-center justify-center shadow-md shadow-black/80">
                              <Play className="size-3 fill-current ml-0.5" />
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
                              <div className="h-full bg-[#38BDF8] w-[50%]" />
                            </div>
                          </div>
                        </div>

                        <div
                          onClick={() => {
                            setActiveTab('player')
                            setOrientation('landscape')
                          }}
                          className="flex-1 rounded-xl overflow-hidden bg-[#10121A] border border-white/10 group relative cursor-pointer"
                        >
                          <div className="relative h-20 bg-slate-800 overflow-hidden">
                            <img
                              src="https://s4.anilist.co/file/anilistcdn/media/anime/banner/20809-Cjon1rP2AnD2.png"
                              alt="Lord Marksman and Vanadis"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 m-auto size-7 rounded-full bg-[#FF2B3C] text-white flex items-center justify-center shadow-md shadow-black/80">
                              <Play className="size-3 fill-current ml-0.5" />
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
                              <div className="h-full bg-[#38BDF8] w-[28%]" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: ANIME DETAILS VIEW (Matching user's Mushoku Tensei Season 3 screenshot) */}
                {activeTab === 'details' && (
                  <div className="flex-1 flex flex-col p-3 overflow-y-auto animate-in fade-in duration-200 text-left space-y-3">
                    {/* Header: Back & Trailer */}
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setActiveTab('home')}
                        className="size-8 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                      >
                        <ChevronLeft className="size-4" />
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('player')
                          setOrientation('landscape')
                        }}
                        className="px-3 py-1 rounded-xl bg-black/70 backdrop-blur-md border border-[#FF2B3C] text-[#FF2B3C] text-[10px] font-black flex items-center gap-1.5 shadow-sm shadow-[#FF2B3C]/30 hover:bg-[#FF2B3C]/10 transition-colors"
                      >
                        <Play className="size-2.5 fill-current" />
                        <span>TRAILER</span>
                      </button>
                    </div>

                    {/* Poster & Metadata */}
                    <div className="flex gap-3 items-start pt-1">
                      <div className="relative w-24 h-36 rounded-2xl overflow-hidden shrink-0 border-2 border-[#FF2B3C] shadow-xl shadow-[#FF2B3C]/20 bg-[#161924]">
                        <img
                          src="https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx178789-hNXjKFzUq7mk.jpg"
                          alt="Mushoku Tensei Season 3"
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 space-y-1">
                        <h3 className="font-display font-black text-sm text-white leading-tight">
                          Mushoku Tensei: Jobless Reincarnation Season 3
                        </h3>
                        <p className="text-[10px] text-slate-400 font-sans">
                          無職転生III ～異世界行ったら本気だす～
                        </p>

                        <div className="flex items-center gap-1.5 pt-1">
                          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-[#161924] text-slate-300 border border-white/5">
                            2026
                          </span>
                          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-[#161924] text-slate-300 border border-white/5">
                            tv
                          </span>
                          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-[#161924] text-slate-300 border border-white/5">
                            ongoing
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Continue Watching CTA & Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => {
                          setActiveTab('player')
                          setOrientation('landscape')
                        }}
                        className="flex-1 h-11 rounded-2xl bg-[#FF2B3C] hover:bg-[#FF4757] text-white flex items-center justify-center gap-2 px-3 shadow-lg shadow-[#FF2B3C]/40 transition-colors"
                      >
                        <Play className="size-3.5 fill-current ml-0.5" />
                        <div className="text-left">
                          <div className="text-[11px] font-black tracking-wide leading-none">
                            CONTINUE WATCHING
                          </div>
                          <div className="text-[9px] text-white/80 font-mono mt-0.5 leading-none">
                            EP 1 • 12m watched
                          </div>
                        </div>
                      </button>

                      <button className="size-11 rounded-2xl bg-[#10121A] hover:bg-[#161924] border border-white/10 flex items-center justify-center text-slate-300 transition-colors">
                        <Bookmark className="size-4" />
                      </button>
                      <button className="size-11 rounded-2xl bg-[#10121A] hover:bg-[#161924] border border-white/10 flex items-center justify-center text-slate-300 transition-colors">
                        <Heart className="size-4" />
                      </button>
                    </div>

                    {/* 4 Stats Metrics */}
                    <div className="grid grid-cols-4 rounded-2xl bg-[#10121A] border border-white/10 p-2.5 divide-x divide-white/5 text-center">
                      <div className="flex flex-col items-center">
                        <Film className="size-3.5 text-[#FF2B3C] mb-0.5" />
                        <span className="text-xs font-black text-white">14</span>
                        <span className="text-[8px] text-slate-400">Episodes</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <Eye className="size-3.5 text-[#FF2B3C] mb-0.5" />
                        <span className="text-xs font-black text-white">2</span>
                        <span className="text-[8px] text-slate-400">Watches</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <Heart className="size-3.5 text-[#FF2B3C] mb-0.5" />
                        <span className="text-xs font-black text-white">0</span>
                        <span className="text-[8px] text-slate-400">Favorites</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <MessageSquare className="size-3.5 text-[#FF2B3C] mb-0.5" />
                        <span className="text-xs font-black text-white">0</span>
                        <span className="text-[8px] text-slate-400">Reviews</span>
                      </div>
                    </div>

                    {/* Genre Pills */}
                    <div className="flex flex-wrap gap-1.5">
                      {['Adventure', 'Drama', 'Ecchi', 'Fantasy'].map((genre) => (
                        <span
                          key={genre}
                          className="text-[9px] font-semibold px-2.5 py-0.5 rounded-full bg-[#181318] text-[#FF4757] border border-[#FF2B3C]/35"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>

                    {/* Characters & Voice Actors */}
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[10px] font-mono font-black text-[#FF2B3C] tracking-wider">
                        {'// CHARACTERS & VOICE ACTORS'}
                      </div>

                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {[
                          {
                            name: 'Rudeus Greyrat',
                            role: 'MAIN',
                            va: 'Madeleine Morris',
                            avatar: 'https://s4.anilist.co/file/anilistcdn/character/large/b127993-yU9Z58F6ZqgG.png',
                          },
                          {
                            name: 'Sylphiette',
                            role: 'MAIN',
                            va: 'Ai Kayano',
                            avatar: 'https://s4.anilist.co/file/anilistcdn/character/large/b127995-sH9U4Yc6iU9L.png',
                          },
                          {
                            name: 'Eris Borea...',
                            role: 'MAIN',
                            va: 'Lindsay Seidel',
                            avatar: 'https://s4.anilist.co/file/anilistcdn/character/large/b127994-xU8Z38wX9a.png',
                          },
                          {
                            name: 'Roxy Migurdia',
                            role: 'MAIN',
                            va: 'Konomi Kohara',
                            avatar: 'https://s4.anilist.co/file/anilistcdn/character/large/b127996-uQ7M18eF3c.png',
                          },
                        ].map((char, i) => (
                          <div
                            key={i}
                            className="flex flex-col items-center text-center shrink-0 w-16"
                          >
                            <div className="size-11 rounded-full overflow-hidden border border-[#FF2B3C]/40 bg-[#161924] shadow-sm mb-1">
                              <img
                                src={char.avatar}
                                alt={char.name}
                                onError={(e) => {
                                  e.currentTarget.src = '/icon.png'
                                }}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <span className="text-[9px] font-bold text-white truncate w-full">
                              {char.name}
                            </span>
                            <span className="text-[7px] font-mono text-slate-500">{char.role}</span>
                            <span className="text-[8px] text-[#38BDF8] truncate w-full">
                              {char.va}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tabs: EPISODES, REVIEWS, INFO */}
                    <div className="flex border-b border-white/10 pt-1">
                      {(['episodes', 'reviews', 'info'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setActiveTabSection(t)}
                          className={`flex-1 pb-1.5 text-[10px] font-bold uppercase transition-all relative ${
                            activeTabSection === t
                              ? 'text-[#FF2B3C]'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {t}
                          {activeTabSection === t && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF2B3C]" />
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Scrollable Episode List */}
                    {activeTabSection === 'episodes' && (
                      <div className="space-y-1.5 pt-1 pb-2">
                        {[
                          {
                            num: 1,
                            title: 'The Guardian Fitz',
                            time: '24m',
                            status: '12m watched',
                            active: true,
                          },
                          {
                            num: 2,
                            title: 'The Forest of the Red Dragon',
                            time: '24m',
                            status: 'Up Next',
                            active: false,
                          },
                          {
                            num: 3,
                            title: 'Labyrinth of Reincarnation',
                            time: '24m',
                            status: null,
                            active: false,
                          },
                        ].map((ep) => (
                          <div
                            key={ep.num}
                            onClick={() => {
                              setActiveTab('player')
                              setOrientation('landscape')
                            }}
                            className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                              ep.active
                                ? 'bg-[#FF2B3C]/10 border-[#FF2B3C]/40 text-white'
                                : 'bg-[#10121A] border-white/5 hover:border-white/20 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-[#FF2B3C]">
                                EP {ep.num}
                              </span>
                              <div>
                                <div className="text-[11px] font-semibold text-white">
                                  {ep.title}
                                </div>
                                <div className="text-[9px] text-slate-400">
                                  {ep.time} {ep.status && `• ${ep.status}`}
                                </div>
                              </div>
                            </div>
                            <div className="size-6 rounded-full bg-[#FF2B3C] text-white flex items-center justify-center shadow-sm">
                              <Play className="size-2.5 fill-current ml-0.5" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: PORTRAIT PLAYER HUD VIEW */}
                {activeTab === 'player' && (
                  <div className="flex-1 flex flex-col justify-between p-3 animate-in fade-in duration-200 text-left bg-black/90">
                    <div className="relative w-full h-48 rounded-2xl overflow-hidden bg-[#0a0a0f] border border-[#38BDF8]/30 shadow-2xl shadow-black">
                      <img
                        src="https://s4.anilist.co/file/anilistcdn/media/anime/banner/20809-Cjon1rP2AnD2.png"
                        alt="Lord Marksman and Vanadis"
                        className="w-full h-full object-cover brightness-[0.9]"
                        onError={(e) => {
                          e.currentTarget.src = '/screenshots/real-app-player.png'
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/70 pointer-events-none" />

                      {/* Top HUD */}
                      <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-20">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setActiveTab('details')}
                            className="size-6 rounded-full bg-black/70 border border-white/10 flex items-center justify-center text-white"
                          >
                            <ChevronLeft className="size-3.5" />
                          </button>
                          <div>
                            <div className="text-[8px] font-bold text-[#38BDF8] uppercase tracking-wider">
                              LORD MARKSMAN AND VANADIS
                            </div>
                            <div className="text-[10px] font-black text-white leading-none">
                              S1:E2 • The Return Home
                            </div>
                          </div>
                        </div>
                        <div className="bg-black/80 px-2 py-0.5 rounded-full border border-white/10 font-mono text-[9px] text-slate-300">
                          <span className="text-[#FF2B3C]">6:46</span> / 24:10
                        </div>
                      </div>

                      {/* Center Glowing Pause */}
                      <div className="absolute inset-0 m-auto flex items-center justify-center gap-4 z-20 pointer-events-auto">
                        <button className="size-7 rounded-full bg-black/60 text-white flex flex-col items-center justify-center text-[7px] font-bold">
                          <RotateCcw className="size-3" />
                          <span>10</span>
                        </button>
                        <button
                          onClick={() => setIsPlaying(!isPlaying)}
                          className="size-11 rounded-full bg-[#10121A] text-white flex items-center justify-center shadow-[0_0_25px_rgba(0,230,118,0.7)] ring-4 ring-[#00E676] hover:scale-110 transition-all"
                        >
                          {isPlaying ? (
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-4 bg-[#FF2B3C] rounded-sm" />
                              <div className="w-1.5 h-4 bg-[#FF2B3C] rounded-sm" />
                            </div>
                          ) : (
                            <Play className="size-4 fill-[#FF2B3C] text-[#FF2B3C] ml-0.5" />
                          )}
                        </button>
                        <button className="size-7 rounded-full bg-black/60 text-white flex flex-col items-center justify-center text-[7px] font-bold">
                          <RotateCw className="size-3" />
                          <span>10</span>
                        </button>
                      </div>

                      {/* Scrubber */}
                      <div className="absolute bottom-2 left-3 right-3 z-20 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-mono text-white font-bold">6:46</span>
                          <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                            <div className="h-full bg-[#FF2B3C] rounded-full w-[28%]" />
                          </div>
                          <span className="text-[8px] font-mono text-slate-400">24:10</span>
                        </div>
                      </div>
                    </div>

                    {/* Rotate Prompt Button */}
                    <button
                      onClick={() => setOrientation('landscape')}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#FF2B3C]/20 via-[#38BDF8]/20 to-[#00E676]/20 border border-white/15 text-xs font-bold text-white flex items-center justify-center gap-2 hover:border-[#38BDF8] transition-all"
                    >
                      <Maximize2 className="size-3.5 text-[#38BDF8]" />
                      <span>Rotate to Fullscreen Cinema Mode</span>
                    </button>

                    {/* Stream Info & Quick Controls */}
                    <div className="p-2.5 rounded-xl bg-[#10121A] border border-white/5 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Resolution</span>
                        <span className="text-[#38BDF8] font-bold font-mono">1080p FHD 60FPS</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Audio Track</span>
                        <span className="text-white font-semibold">Japanese (Eng Soft-Sub)</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Buffer Health</span>
                        <span className="text-[#00E676] font-mono">100% (Instant Seek)</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: OFFLINE LIBRARY VIEW (Matching real Android screenshot) */}
                {activeTab === 'offline' && (
                  <div className="flex-1 flex flex-col p-4 overflow-y-auto animate-in fade-in duration-200 text-left space-y-4">
                    {/* Header: Back & Title */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setActiveTab('home')}
                        className="size-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white transition-colors"
                      >
                        <ChevronLeft className="size-5" />
                      </button>
                      <div>
                        <h3 className="font-display font-black text-lg text-white leading-tight">
                          Offline Library
                        </h3>
                        <p className="text-xs text-slate-400 font-sans">
                          2 titles available offline
                        </p>
                      </div>
                    </div>

                    {/* Sort Row */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] font-mono font-bold text-slate-400 tracking-wider">
                        SORT:
                      </span>
                      <button className="px-3 py-1 rounded-full bg-[#FF2B3C]/10 border border-[#FF2B3C] text-white text-[11px] font-bold shadow-sm shadow-[#FF2B3C]/20">
                        Recent
                      </button>
                      <button className="px-3 py-1 rounded-full bg-[#141722] border border-white/5 text-slate-400 text-[11px] font-medium hover:text-white transition-colors">
                        Title (A-Z)
                      </button>
                      <button className="px-3 py-1 rounded-full bg-[#141722] border border-white/5 text-slate-400 text-[11px] font-medium hover:text-white transition-colors">
                        Largest Size
                      </button>
                    </div>

                    {/* Downloaded Titles List */}
                    <div className="space-y-3 pt-2">
                      {/* Item 1: Mushoku Tensei Season 3 */}
                      <div
                        onClick={() => {
                          setActiveTab('details')
                          setOrientation('portrait')
                        }}
                        className="flex items-center justify-between p-2 rounded-2xl bg-transparent hover:bg-white/[0.03] transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="relative w-14 h-20 rounded-xl overflow-hidden shrink-0 border border-white/10 shadow-md bg-[#161924]">
                            <img
                              src="/screenshots/poster-mushoku-offline.png"
                              alt="Mushoku Tensei Season 3"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx178789-hNXjKFzUq7mk.jpg'
                              }}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <h4 className="font-bold text-xs sm:text-sm text-white group-hover:text-[#FF4757] transition-colors leading-snug">
                              Mushoku Tensei: Jobless<br />Reincarnation Season 3
                            </h4>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0c2233] border border-[#38BDF8]/30 text-[#38BDF8] font-bold text-[10px]">
                                <Film className="size-2.5" />
                                <span>1 EP</span>
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#2a0e14] border border-[#FF2B3C]/30 text-[#FF4757] font-bold text-[10px] font-mono">
                                <Bookmark className="size-2.5" />
                                <span>155.8 MB</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-slate-500 group-hover:text-white transition-colors pr-1">
                          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </div>
                      </div>

                      <div className="h-px bg-white/5" />

                      {/* Item 2: Lord Marksman and Vanadis */}
                      <div
                        onClick={() => {
                          setActiveTab('player')
                          setOrientation('landscape')
                        }}
                        className="flex items-center justify-between p-2 rounded-2xl bg-transparent hover:bg-white/[0.03] transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="relative w-14 h-20 rounded-xl overflow-hidden shrink-0 border border-white/10 shadow-md bg-[#161924]">
                            <img
                              src="/screenshots/poster-vanadis-offline.png"
                              alt="Lord Marksman and Vanadis"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = '/screenshots/real-app-offline.png'
                              }}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <h4 className="font-bold text-xs sm:text-sm text-white group-hover:text-[#FF4757] transition-colors leading-snug">
                              Lord Marksman and Vanadis
                            </h4>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0c2233] border border-[#38BDF8]/30 text-[#38BDF8] font-bold text-[10px]">
                                <Film className="size-2.5" />
                                <span>1 EP</span>
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#2a0e14] border border-[#FF2B3C]/30 text-[#FF4757] font-bold text-[10px] font-mono">
                                <Bookmark className="size-2.5" />
                                <span>269.2 MB</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-slate-500 group-hover:text-white transition-colors pr-1">
                          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bottom Navigation Tabs */}
                <div className="relative z-20 border-t border-white/5 bg-[#08090D] px-3 py-1.5 flex items-center justify-around text-[10px]">
                  <button
                    onClick={() => {
                      setActiveTab('home')
                      setOrientation('portrait')
                    }}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <div
                      className={`px-3.5 py-0.5 rounded-full transition-all ${
                        activeTab === 'home'
                          ? 'bg-[#FF2B3C]/20 text-[#FF2B3C] border border-[#FF2B3C]/40'
                          : 'text-slate-400'
                      }`}
                    >
                      <Home className="size-4 fill-current" />
                    </div>
                    <span
                      className={`text-[10px] font-bold ${
                        activeTab === 'home' ? 'text-[#FF2B3C]' : 'text-slate-500'
                      }`}
                    >
                      Home
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('details')
                      setOrientation('portrait')
                    }}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <div
                      className={`px-3.5 py-0.5 rounded-full transition-all ${
                        activeTab === 'details'
                          ? 'bg-[#FF2B3C]/20 text-[#FF2B3C] border border-[#FF2B3C]/40'
                          : 'text-slate-400'
                      }`}
                    >
                      <Compass className="size-4" />
                    </div>
                    <span
                      className={`text-[10px] font-bold ${
                        activeTab === 'details' ? 'text-[#FF2B3C]' : 'text-slate-500'
                      }`}
                    >
                      Details
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('offline')
                      setOrientation('portrait')
                    }}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <div
                      className={`px-3.5 py-0.5 rounded-full transition-all ${
                        activeTab === 'offline'
                          ? 'bg-[#FF2B3C]/20 text-[#FF2B3C] border border-[#FF2B3C]/40'
                          : 'text-slate-400'
                      }`}
                    >
                      <Bookmark className="size-4" />
                    </div>
                    <span
                      className={`text-[10px] font-medium ${
                        activeTab === 'offline' ? 'text-[#FF2B3C]' : 'text-slate-500'
                      }`}
                    >
                      Library
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab('home')}
                    className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-200"
                  >
                    <div className="px-3.5 py-0.5">
                      <User className="size-4 text-slate-400" />
                    </div>
                    <span className="text-[10px] font-medium text-slate-500">Profile</span>
                  </button>
                </div>

                {/* Android 3-Button Navigation Bar */}
                <div className="w-full py-1 px-8 flex justify-around items-center bg-[#08090D] border-t border-white/5 opacity-70">
                  <svg
                    className="size-3 text-slate-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polygon points="19 20 9 12 19 4 19 20" />
                  </svg>
                  <div className="size-3 rounded-full border-2 border-slate-400" />
                  <div className="size-2.5 rounded-[2px] border-2 border-slate-400" />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Screen Switcher Pills */}
      <div className="grid grid-cols-2 xs:grid-cols-4 gap-1.5 p-1.5 rounded-2xl bg-[#10121A] border border-white/10 backdrop-blur-md shadow-lg w-full max-w-[340px] xs:max-w-lg">
        <button
          onClick={() => {
            setActiveTab('home')
            setOrientation('portrait')
          }}
          className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
            activeTab === 'home'
              ? 'bg-[#FF2B3C] text-white shadow-[0_0_15px_rgba(255,43,60,0.4)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>🏠 Home</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('details')
            setOrientation('portrait')
          }}
          className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
            activeTab === 'details'
              ? 'bg-[#FF2B3C] text-white shadow-[0_0_15px_rgba(255,43,60,0.4)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>📜 Details</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('player')
            setOrientation('landscape')
          }}
          className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
            activeTab === 'player'
              ? 'bg-[#FF2B3C] text-white shadow-[0_0_15px_rgba(255,43,60,0.4)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>🎬 Player</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('offline')
            setOrientation('portrait')
          }}
          className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
            activeTab === 'offline'
              ? 'bg-[#FF2B3C] text-white shadow-[0_0_15px_rgba(255,43,60,0.4)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>💾 Library</span>
        </button>
      </div>
    </div>
  )
}
