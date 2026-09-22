import React from 'react'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'

export function FAQSection() {
  const faqs = [
    {
      id: 'faq-1',
      question: 'Is AnimeHub APK completely free to download and use?',
      answer:
        'Yes! AnimeHub is 100% free with no hidden subscription fees, paywalls, or credit card requirements. You get full unrestricted access to 10,000+ anime titles at the highest quality possible.',
    },
    {
      id: 'faq-2',
      question: 'Is it safe to install the AnimeHub APK on Android?',
      answer:
        'Absolutely. AnimeHub contains 0 malware, 0 adware, and zero trackers. It only requests standard network permissions and media access if you choose to download episodes offline. You can also verify the SHA-256 checksum on our download modal.',
    },
    {
      id: 'faq-3',
      question: 'How do I update AnimeHub when a new version is released?',
      answer:
        'AnimeHub includes an in-app update checker. Whenever a new version is published, you will receive a lightweight notification with a 1-click update prompt to download and install the latest APK without losing your saved watchlist or offline episodes.',
    },
    {
      id: 'faq-4',
      question: 'Does my watchlist sync with the AnimeHub web version?',
      answer:
        'Yes! When you log in with your Supabase account, your entire watchlist, favorites, and playback history sync in real time across the Android app and the AnimeHub web app.',
    },
    {
      id: 'faq-5',
      question: 'Can I cast anime episodes to my Smart TV or Chromecast?',
      answer:
        'Yes. The video player has built-in Google Cast and local screen mirroring support, allowing you to cast high-definition streams directly to your TV with synchronized subtitles.',
    },
    {
      id: 'faq-6',
      question: 'What video quality does AnimeHub support?',
      answer:
        'AnimeHub streams every episode in up to crisp 1080p FHD at the highest quality possible, with adaptive bitrates that automatically adjust if your internet connection fluctuates.',
    },
  ]

  return (
    <section id="faq" className="py-24 relative overflow-hidden bg-[#08090D]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center space-y-4 mb-16">
          <Badge variant="neon" className="text-xs">
            Got Questions?
          </Badge>
          <h2 className="font-display text-3xl sm:text-5xl font-black text-white tracking-tight">
            Frequently Asked <span className="text-gradient-crimson">Questions</span>
          </h2>
          <p className="text-sm sm:text-base text-slate-400">
            Everything you need to know about AnimeHub APK, safety, features, and syncing.
          </p>
        </div>

        <Accordion defaultOpen="faq-1">
          {faqs.map((faq) => (
            <AccordionItem key={faq.id} id={faq.id}>
              <AccordionTrigger id={faq.id}>{faq.question}</AccordionTrigger>
              <AccordionContent id={faq.id}>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
