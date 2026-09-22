import React, { useState } from 'react'
import { Navbar } from '@/components/Navbar'
import { Hero } from '@/components/Hero'
import { AppScreensShowcase } from '@/components/AppScreensShowcase'
import { FeaturesSection } from '@/components/FeaturesSection'
import { AnimeShowcase } from '@/components/AnimeShowcase'
import { ArchitectureSection } from '@/components/ArchitectureSection'
import { InstallationGuide } from '@/components/InstallationGuide'
import { FAQSection } from '@/components/FAQSection'
import { Footer } from '@/components/Footer'
import { FloatingDownloadBar } from '@/components/FloatingDownloadBar'
import { DownloadModal } from '@/components/DownloadModal'

export function App() {
  const [downloadModalOpen, setDownloadModalOpen] = useState(false)
  const [downloadTab, setDownloadTab] = useState<'download' | 'qr' | 'guide'>('download')

  const handleOpenDownload = (tab: 'download' | 'qr' | 'guide' = 'download') => {
    setDownloadTab(tab)
    setDownloadModalOpen(true)
  }

  return (
    <div className="min-h-screen bg-[#08090D] text-slate-100 flex flex-col font-sans selection:bg-[#FF2B3C] selection:text-white">
      {/* Navigation */}
      <Navbar onOpenDownload={() => handleOpenDownload('download')} />

      {/* Main Page Content */}
      <main className="flex-1">
        <Hero onOpenDownload={handleOpenDownload} />
        <AppScreensShowcase onOpenDownload={() => handleOpenDownload('download')} />
        <FeaturesSection />
        <AnimeShowcase onOpenDownload={() => handleOpenDownload('download')} />
        <ArchitectureSection />
        <InstallationGuide onOpenDownload={() => handleOpenDownload('download')} />
        <FAQSection />
      </main>

      {/* Footer */}
      <Footer />

      {/* Floating Download Bar on Scroll */}
      <FloatingDownloadBar onOpenDownload={() => handleOpenDownload('download')} />

      {/* Download APK / QR Modal */}
      <DownloadModal
        open={downloadModalOpen}
        onOpenChange={setDownloadModalOpen}
        initialTab={downloadTab}
      />
    </div>
  )
}

export default App
