'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { PreviewLinkCard } from '@/components/ui/preview-link-card'
import { submitContactMessage } from '@/app/actions/contact'

interface CreatorFooterProps {
  profileData: any;
  creatorName: string;
}

export default function CreatorFooter({ profileData, creatorName }: CreatorFooterProps) {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus('idle')
    setErrorMessage('')

    const res = await submitContactMessage(creatorName, formData)
    if (res.success) {
      setSubmitStatus('success')
      setFormData({ name: '', email: '', message: '' })
    } else {
      setSubmitStatus('error')
      setErrorMessage(res.error || '오류가 발생했습니다. 다시 시도해주세요.')
    }
    setIsSubmitting(false)
  }

  return (
    <footer className="w-full bg-[#1A1A1A] text-white pt-16 pb-12 px-6 md:px-12 lg:px-24">
      <div className="max-w-[1440px] mx-auto">
        
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-8 mb-20">
          
          {/* Column 1: Sponsors / Support */}
          <div className="md:col-span-4 flex flex-col">
            <h3 className="text-[#888888] font-bold text-sm mb-6 tracking-wide">Support Creator</h3>
            
            {profileData.sns_settings?.patreon && profileData.patreon_url ? (
              <PreviewLinkCard href={profileData.patreon_url} asChild>
                <a href={profileData.patreon_url} target="_blank" rel="noopener noreferrer" className="bg-transparent hover:bg-[#222222] border border-transparent hover:border-[#333333] transition-all rounded-lg p-4 flex items-center justify-between group mb-2 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-[#333333] flex items-center justify-center text-[#AAAAAA] group-hover:text-[#FF424D] transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15.386 0.524c-4.764 0-8.64 3.876-8.64 8.64 0 4.75 3.876 8.613 8.64 8.613 4.75 0 8.614-3.864 8.614-8.613C24 4.4 20.136.524 15.386.524zM0 24h3.618V.524H0V24z"/></svg>
                    </div>
                    <span className="font-semibold text-[#CCCCCC] group-hover:text-white transition-colors">Become a Patreon</span>
                  </div>
                  <span className="text-[#666666] group-hover:text-white transition-colors">↗</span>
                </a>
              </PreviewLinkCard>
            ) : (
              <div className="bg-transparent border border-transparent rounded-lg p-4 flex items-center justify-between group mb-2 opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-[#333333] flex items-center justify-center text-[#AAAAAA]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15.386 0.524c-4.764 0-8.64 3.876-8.64 8.64 0 4.75 3.876 8.613 8.64 8.613 4.75 0 8.614-3.864 8.614-8.613C24 4.4 20.136.524 15.386.524zM0 24h3.618V.524H0V24z"/></svg>
                  </div>
                  <span className="font-semibold text-[#CCCCCC]">Become a Patreon</span>
                </div>
                <span className="text-[#666666]">↗</span>
              </div>
            )}
            
            <a href={`mailto:${profileData.contact_email}`} className="bg-transparent hover:bg-[#222222] border border-transparent hover:border-[#333333] transition-all rounded-lg p-4 flex items-center justify-between group cursor-pointer">
              <span className="font-semibold text-[#CCCCCC] group-hover:text-white transition-colors ml-11">Business Inquiry</span>
              <span className="text-[#666666] group-hover:text-white transition-colors">↗</span>
            </a>
          </div>

          {/* Column 2: Site */}
          <div className="md:col-span-3 md:col-start-6 flex flex-col">
            <h3 className="text-[#888888] font-bold text-sm mb-6 tracking-wide">Site</h3>
            <ul className="space-y-1">
              <li>
                <Link href="/" className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-[#222222] group transition-all text-[#CCCCCC] hover:text-white">
                  <span className="font-semibold text-[15px]">Home</span>
                  <span className="text-[#666666] group-hover:text-white transition-colors text-lg">→</span>
                </Link>
              </li>
              <li>
                <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-[#222222] group transition-all text-[#CCCCCC] hover:text-white">
                  <span className="font-semibold text-[15px]">Portfolio Top</span>
                  <span className="text-[#666666] group-hover:text-white transition-colors text-lg">↑</span>
                </button>
              </li>
              <li>
                <button onClick={() => document.getElementById('portfolio-start')?.scrollIntoView({ behavior: 'smooth' })} className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-[#222222] group transition-all text-[#CCCCCC] hover:text-white">
                  <span className="font-semibold text-[15px]">Projects</span>
                  <span className="text-[#666666] group-hover:text-white transition-colors text-lg">↓</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Socials */}
          <div className="md:col-span-3 md:col-start-10 flex flex-col">
            <h3 className="text-[#888888] font-bold text-sm mb-6 tracking-wide">Socials</h3>
            <ul className="space-y-1">
              {profileData.sns_settings?.twitter && profileData.twitter_url && (
                <li>
                  <PreviewLinkCard href={profileData.twitter_url} asChild>
                    <a href={profileData.twitter_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-[#222222] group transition-all text-[#CCCCCC] hover:text-white">
                      <span className="font-semibold text-[15px]">X / Twitter</span>
                      <span className="text-[#666666] group-hover:text-white transition-colors text-sm">↗</span>
                    </a>
                  </PreviewLinkCard>
                </li>
              )}
              {profileData.sns_settings?.youtube && profileData.youtube_url && (
                <li>
                  <PreviewLinkCard href={profileData.youtube_url} asChild>
                    <a href={profileData.youtube_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-[#222222] group transition-all text-[#CCCCCC] hover:text-white">
                      <span className="font-semibold text-[15px]">YouTube</span>
                      <span className="text-[#666666] group-hover:text-white transition-colors text-sm">↗</span>
                    </a>
                  </PreviewLinkCard>
                </li>
              )}
              {profileData.sns_settings?.instagram && profileData.instagram_url && (
                <li>
                  <PreviewLinkCard href={profileData.instagram_url} asChild>
                    <a href={profileData.instagram_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-[#222222] group transition-all text-[#CCCCCC] hover:text-white">
                      <span className="font-semibold text-[15px]">Instagram</span>
                      <span className="text-[#666666] group-hover:text-white transition-colors text-sm">↗</span>
                    </a>
                  </PreviewLinkCard>
                </li>
              )}
              {profileData.sns_settings?.discord && profileData.discord_id && (
                <li>
                  <div className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-[#222222] group transition-all text-[#CCCCCC] hover:text-white cursor-pointer" onClick={() => {
                    navigator.clipboard.writeText(profileData.discord_id)
                    alert('Discord ID Copied!')
                  }}>
                    <span className="font-semibold text-[15px]">Discord</span>
                    <span className="text-[#666666] group-hover:text-white transition-colors text-xs font-bold uppercase">Copy ID</span>
                  </div>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between pt-8">
          
          {/* Logo & Copyright */}
          <div className="flex flex-col gap-2 mb-10 md:mb-0 w-full md:w-auto">
            <div className="flex items-center gap-2 mb-2">
              <div className="relative w-7 h-7 opacity-90">
                <Image src="/logo_icon_white.png" alt="BlockCanvas Logo" fill className="object-contain" />
              </div>
              <span className="font-black text-xl tracking-tighter text-white">BLOCKCANVAS<span className="text-[#FF424D]">.</span></span>
            </div>
            <p className="text-[#666666] text-sm font-medium">© 2026 {profileData.display_name}. All rights reserved.</p>
            <p className="text-[#444444] text-[10px] mt-1 font-medium max-w-md leading-relaxed">
              Open Source Licenses: Next.js (MIT), React (MIT), Tailwind CSS (MIT), Framer Motion (MIT), GSAP (Standard), Prisma (Apache-2.0), Radix UI (MIT), Lucide (ISC), Lenis (MIT), Animate UI (MIT).
            </p>
          </div>

          {/* Contact Form */}
          <div className="flex flex-col w-full md:w-auto md:min-w-[340px]">
            <h3 className="text-[#888888] font-bold text-sm mb-3 tracking-wide">Contact Me</h3>
            {submitStatus === 'success' ? (
              <div className="bg-[#2A2A2A] text-white px-4 py-4 w-full rounded-md text-sm text-center border border-[#333333]">
                메시지가 성공적으로 전송되었습니다!
              </div>
            ) : (
              <form className="flex flex-col w-full gap-2" onSubmit={handleSubmit}>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Name" 
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-[#2A2A2A] text-white placeholder-[#888888] px-3 py-2 w-1/3 focus:outline-none transition-all text-sm font-medium border border-[#333333] focus:border-[#555555] rounded-md"
                    required
                  />
                  <input 
                    type="email" 
                    placeholder="Email" 
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="bg-[#2A2A2A] text-white placeholder-[#888888] px-3 py-2 w-2/3 focus:outline-none transition-all text-sm font-medium border border-[#333333] focus:border-[#555555] rounded-md"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <textarea 
                    placeholder="Message" 
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="bg-[#2A2A2A] text-white placeholder-[#888888] px-3 py-2 w-full focus:outline-none transition-all text-sm font-medium border border-[#333333] focus:border-[#555555] rounded-md resize-none h-[42px]"
                    required
                  />
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="bg-[#EAEAEA] hover:bg-white text-black px-4 py-2 font-bold text-sm transition-colors rounded-md disabled:opacity-50 whitespace-nowrap"
                  >
                    {isSubmitting ? '...' : 'Send'}
                  </button>
                </div>
                {submitStatus === 'error' && (
                  <p className="text-red-400 text-xs mt-1 font-bold">{errorMessage}</p>
                )}
              </form>
            )}
          </div>
        </div>

      </div>
    </footer>
  )
}
