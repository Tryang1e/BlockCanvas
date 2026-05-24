'use client'

import React, { useRef, useEffect, useState } from 'react'
import Image from 'next/image'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { PreviewLinkCard } from '@/components/ui/preview-link-card'
import CreatorFooter from '@/components/layout/CreatorFooter'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

export default function BusinessCardContact({ profileData, profile, footer_title, footer_subtitle }: { profileData: any, profile: any, footer_title?: string, footer_subtitle?: string }) {
  const keywords = [footer_title || 'BLOCK CANVAS', profile.display_name || profile.creator_name, footer_subtitle || 'CREATOR']
  const containerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const contentRefs = useRef<HTMLElement[]>([])

  // Clipboard state
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Reveal state
  const [isRevealed, setIsRevealed] = useState(false)

  // Text fill refs
  const fg1 = useRef<HTMLSpanElement>(null)
  const fg2 = useRef<HTMLSpanElement>(null)
  const fg3 = useRef<HTMLSpanElement>(null)

  const handleCopy = (text: string, field: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Tilt Effect
  useEffect(() => {
    const card = cardRef.current
    if (!card) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const centerX = rect.width / 2
      const centerY = rect.height / 2

      // Calculate rotation based on mouse position (reduced to max 5 degrees for subtlety)
      const rotateX = ((y - centerY) / centerY) * -5
      const rotateY = ((x - centerX) / centerX) * 5

      gsap.to(card, {
        rotateX,
        rotateY,
        duration: 0.5,
        ease: 'power2.out',
        transformPerspective: 1000,
        transformOrigin: 'center center'
      })
    }

    const handleMouseLeave = () => {
      gsap.to(card, {
        rotateX: 0,
        rotateY: 0,
        duration: 1.0,
        ease: 'elastic.out(1, 0.3)'
      })
    }

    card.addEventListener('mousemove', handleMouseMove)
    card.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      card.removeEventListener('mousemove', handleMouseMove)
      card.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  // Advanced Showcase Level Animation
  useEffect(() => {
    const card = cardRef.current
    if (!card) return

    const leftContainer = card.querySelector('.left-container')
    const rightContainer = card.querySelector('.right-container')
    const avatar = card.querySelector('.avatar-container')
    const spotlight = containerRef.current?.querySelector('.spotlight')
    const leftImage = card.querySelector('.left-image')
    const textLines = card.querySelectorAll('.reveal-text')
    const ghost1 = containerRef.current?.querySelector('.ghost-card-1')
    const ghost2 = containerRef.current?.querySelector('.ghost-card-2')
    const grid = containerRef.current?.querySelector('.bg-grid')

    let ctx = gsap.context(() => {
      // 1. Initial State
      if (spotlight) gsap.set(spotlight, { scale: 0, opacity: 0 })
      if (leftContainer) gsap.set(leftContainer, { clipPath: 'inset(0 100% 0 0)' })
      if (leftImage) gsap.set(leftImage, { scale: 1.6, filter: 'blur(20px)', opacity: 0 })
      if (textLines.length > 0) gsap.set(textLines, { y: 80, opacity: 0, rotationX: -90, transformOrigin: '0% 50% -50' })
      if (avatar) gsap.set(avatar, { scale: 0, opacity: 0, rotation: -180 })
      const ghosts = [ghost1, ghost2].filter(Boolean)
      if (ghosts.length > 0) gsap.set(ghosts, { opacity: 0, scale: 0.8 })

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top center',
          end: 'bottom bottom',
          scrub: 1.5
        }
      })

      // Text Fill Animation
      if (fg1.current) tl.fromTo(fg1.current, { clipPath: 'inset(-50% 100% -50% -10%)' }, { clipPath: 'inset(-50% -10% -50% -10%)', ease: 'none', duration: 1 })
      if (fg2.current) tl.fromTo(fg2.current, { clipPath: 'inset(-50% 100% -50% -10%)' }, { clipPath: 'inset(-50% -10% -50% -10%)', ease: 'none', duration: 1 }, '-=0.5')
      if (fg3.current) tl.fromTo(fg3.current, { clipPath: 'inset(-50% 100% -50% -10%)' }, { clipPath: 'inset(-50% -10% -50% -10%)', ease: 'none', duration: 1 }, '-=0.5')

      // Fade in Card Border & Click Prompt
      tl.to(card, { borderColor: 'rgba(212, 212, 216, 1)', backgroundColor: 'rgba(255, 255, 255, 0.4)', duration: 1 }, '+=0.2')
      tl.to('.card-click-prompt', { opacity: 1, duration: 1 }, '<')

      // 3. Ambient Spotlight & Ghosts Reveal (happens silently in background)
      if (spotlight) tl.to(spotlight, { scale: 1, opacity: 1, duration: 2.5, ease: 'power3.out' }, 0)
      if (ghosts.length > 0) tl.to(ghosts, { opacity: 1, scale: 1, duration: 3, ease: 'expo.out', stagger: 0.2 }, 0.5)

      if (ghost1) gsap.to(ghost1, { y: "-=40", rotationZ: 3, duration: 8, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      if (ghost2) gsap.to(ghost2, { y: "+=50", rotationZ: -4, duration: 12, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    });

    return () => ctx.revert();
  }, [])

  useEffect(() => {
    // Profile Content Animations (triggered when isRevealed becomes true)
    if (isRevealed && cardRef.current) {
      const card = cardRef.current
      const leftContainer = card.querySelector('.left-container')
      const leftImage = card.querySelector('.left-image')
      const textLines = card.querySelectorAll('.reveal-text')
      const avatar = card.querySelector('.avatar-container')

      if (leftContainer) gsap.to(leftContainer, { clipPath: 'inset(0 0% 0 0)', duration: 1.6, ease: 'power4.inOut' })
      if (leftImage) gsap.to(leftImage, { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 2, ease: 'power3.out', delay: 0.3 })
      if (textLines.length > 0) gsap.to(textLines, { y: 0, opacity: 1, rotationX: 0, duration: 1.2, ease: 'power3.out', stagger: 0.1, delay: 0.5 })
      if (avatar) gsap.to(avatar, { scale: 1, opacity: 1, rotation: 0, duration: 1.5, ease: 'expo.out', delay: 1 })

      // Notify ScrollTrigger and Lenis of height change and scroll down to reveal footer
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'))
        ScrollTrigger.refresh()
        window.scrollBy({ top: 400, behavior: 'smooth' })
      }, 1000)
    }
  }, [isRevealed])

  useEffect(() => {
    const card = cardRef.current
    if (!card) return

    const leftContainer = card.querySelector('.left-container')
    const rightContainer = card.querySelector('.right-container')
    const avatar = card.querySelector('.avatar-container')
    const ghost1 = containerRef.current?.querySelector('.ghost-card-1')
    const ghost2 = containerRef.current?.querySelector('.ghost-card-2')
    const grid = containerRef.current?.querySelector('.bg-grid')

    // 3. Butter-smooth 3D Hover Interaction with quickTo
    const xTo = gsap.quickTo(card, "rotationY", { ease: "power3", duration: 0.8 })
    const yTo = gsap.quickTo(card, "rotationX", { ease: "power3", duration: 0.8 })
    const leftZTo = gsap.quickTo(leftContainer, "z", { ease: "power4.out", duration: 0.6 })
    const rightZTo = gsap.quickTo(rightContainer, "z", { ease: "power4.out", duration: 0.6 })
    const avatarZTo = gsap.quickTo(avatar, "z", { ease: "power4.out", duration: 0.8 })

    // Parallax background quickTo
    const g1X = ghost1 ? gsap.quickTo(ghost1, "x", { ease: "power3", duration: 1.5 }) : () => { }
    const g1Y = ghost1 ? gsap.quickTo(ghost1, "y", { ease: "power3", duration: 1.5 }) : () => { }
    const g2X = ghost2 ? gsap.quickTo(ghost2, "x", { ease: "power3", duration: 2 }) : () => { }
    const g2Y = ghost2 ? gsap.quickTo(ghost2, "y", { ease: "power3", duration: 2 }) : () => { }
    const gridX = grid ? gsap.quickTo(grid, "x", { ease: "power3", duration: 1 }) : () => { }
    const gridY = grid ? gsap.quickTo(grid, "y", { ease: "power3", duration: 1 }) : () => { }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const centerX = rect.width / 2
      const centerY = rect.height / 2

      const offsetX = x - centerX
      const offsetY = y - centerY

      const rotateX = (offsetY / centerY) * -12
      const rotateY = (offsetX / centerX) * 12

      xTo(rotateY)
      yTo(rotateX)

      // Dynamic Hologram Depth Pop
      leftZTo(30)
      rightZTo(60)
      avatarZTo(120) // Avatar floats highest

      // Background Parallax
      g1X(offsetX * -0.1)
      g1Y(offsetY * -0.1)
      g2X(offsetX * 0.15)
      g2Y(offsetY * 0.15)
      gridX(offsetX * 0.05)
      gridY(offsetY * 0.05)
    }

    const handleMouseLeave = () => {
      // Return to flat state smoothly
      gsap.to(card, { rotationX: 0, rotationY: 0, duration: 1.2, ease: 'power3.out' })
      const elements = [leftContainer, rightContainer, avatar].filter(Boolean)
      if (elements.length > 0) gsap.to(elements, { z: 0, duration: 1.2, ease: 'power3.out' })
      const bgElements = [ghost1, ghost2, grid].filter(Boolean)
      if (bgElements.length > 0) gsap.to(bgElements, { x: 0, y: 0, duration: 1.2, ease: 'power3.out' })
    }

    card.addEventListener('mousemove', handleMouseMove)
    card.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      ScrollTrigger.getAll().forEach(t => t.kill())
      card.removeEventListener('mousemove', handleMouseMove)
      card.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  const cardImage = profileData.banner_url || profile.avatar_url || 'https://images.unsplash.com/photo-1607513746994-5c91b5853503?q=80&w=1000&auto=format&fit=crop'

  return (
    <>
    <section id="contact" ref={containerRef} className="relative w-full overflow-hidden bg-white dark:bg-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 h-[120vh] flex flex-col justify-center items-center px-4 md:px-8 border-t border-neutral-200 dark:border-neutral-800 perspective-[2000px]">

      {/* Light Block Canvas Grid */}
      <div className="bg-grid absolute inset-[-10%] w-[120%] h-[120%] bg-[linear-gradient(to_right,#00000006_1px,transparent_1px),linear-gradient(to_bottom,#00000006_1px,transparent_1px)] bg-[size:4rem_4rem]" />

      {/* Floating Canvas Blocks (Modern Voxel Theme) */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden flex items-center justify-center">
        {/* Soft colorful glow radiating from the center */}
        <div className="absolute w-[80vw] max-w-[800px] h-[400px] opacity-20 mix-blend-multiply blur-[100px] rounded-full z-0">
          <Image src={cardImage} alt="glow" fill className="object-cover" />
        </div>

        {/* Floating White Blocks */}
        <div className="ghost-card-1 absolute w-32 h-32 bg-white dark:bg-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 rounded-3xl border border-neutral-100 shadow-[0_20px_40px_rgba(0,0,0,0.06)] -left-10 md:left-[10%] top-[20%] rotate-12" />
        <div className="ghost-card-2 absolute w-48 h-48 bg-white dark:bg-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 /60 backdrop-blur-md rounded-[2.5rem] border border-white shadow-[0_20px_50px_rgba(0,0,0,0.04)] -right-16 md:right-[8%] bottom-[15%] rotate-[-15deg]" />
        <div className="bg-grid absolute w-16 h-16 bg-white dark:bg-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 rounded-2xl border border-neutral-100 shadow-[0_10px_20px_rgba(0,0,0,0.05)] left-[20%] bottom-[20%] rotate-45" />
        <div className="bg-grid absolute w-20 h-20 bg-white dark:bg-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 /80 backdrop-blur-sm rounded-2xl border border-neutral-100 shadow-[0_15px_30px_rgba(0,0,0,0.05)] right-[25%] top-[15%] rotate-[-20deg]" />
      </div>

      {/* 3D Card Container */}
      <div
        ref={cardRef}
        onClick={() => !isRevealed && setIsRevealed(true)}
        className={`relative z-10 w-full max-w-[1200px] min-h-[450px] rounded-[3rem] overflow-hidden flex flex-col md:flex-row transform-gpu ${isRevealed
          ? 'bg-white dark:bg-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 shadow-[0_30px_80px_rgba(0,0,0,0.08)] border border-neutral-100/80 cursor-default p-0'
          : 'bg-transparent border-2 border-dashed border-transparent cursor-pointer p-8 md:p-16'
          }`}
        style={{ transformStyle: 'preserve-3d', transition: 'background-color 1s, border-color 1s, box-shadow 1s, padding 1s' }}
      >
        {/* Outline State Placeholder (Text Fill) */}
        {!isRevealed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-50 text-neutral-400 pointer-events-none">
            <div className="text-[4rem] sm:text-[6rem] md:text-[8rem] lg:text-[9rem] font-black tracking-tighter uppercase leading-[0.85] text-center w-full break-words">
              {/* Keyword 1 */}
              <div className="relative block w-full">
                <span className="text-transparent" style={{ WebkitTextStroke: '2px #d4d4d8' }}>{keywords[0]}</span>
                <span ref={fg1} className="absolute top-0 left-0 w-full text-neutral-900 dark:text-neutral-50 pointer-events-none" style={{ clipPath: 'inset(-50% 100% -50% -10%)' }}>{keywords[0]}</span>
              </div>
              {/* Keyword 2 */}
              <div className="relative block w-full">
                <span className="text-transparent" style={{ WebkitTextStroke: '2px #d4d4d8' }}>{keywords[1]}</span>
                <span ref={fg2} className="absolute top-0 left-0 w-full text-neutral-900 dark:text-neutral-50 pointer-events-none" style={{ clipPath: 'inset(-50% 100% -50% -10%)' }}>{keywords[1]}</span>
              </div>
              {/* Keyword 3 */}
              <div className="relative block w-full">
                <span className="text-transparent" style={{ WebkitTextStroke: '2px #d4d4d8' }}>{keywords[2]}</span>
                <span ref={fg3} className="absolute top-0 left-0 w-full text-neutral-900 dark:text-neutral-50 pointer-events-none" style={{ clipPath: 'inset(-50% 100% -50% -10%)' }}>{keywords[2]}</span>
              </div>
            </div>

            {/* Click to Reveal Prompt */}
            <div className="absolute bottom-10 opacity-0 card-click-prompt pointer-events-auto">
              <span className="bg-black text-white px-8 py-4 rounded-full text-sm font-bold tracking-widest uppercase animate-pulse shadow-xl hover:scale-105 transition-transform cursor-pointer">
                Click to Open Profile
              </span>
            </div>
          </div>
        )}

        {/* Revealed Content Wrapper */}
        <div className={`w-full flex flex-col md:flex-row transition-opacity duration-1000 ${isRevealed ? 'opacity-100' : 'opacity-0'}`}>
          {/* Left Side: Image */}
          <div className="w-full md:w-[45%] h-72 md:h-auto relative p-6 flex-shrink-0" style={{ transform: 'translateZ(30px)' }}>
            <div className="left-container w-full h-full relative rounded-[2rem] overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,0.1)] group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cardImage}
                alt="Creator Showcase"
                className="left-image absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
              />
              {/* Overlay Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

              {/* Bottom Right Logo Block Decor */}
              <div className="absolute bottom-4 right-4 w-10 h-10 opacity-50">
                <Image src="/logo_icon_white.png" alt="Decor" fill className="object-contain" />
              </div>

              {/* Note: This is where we can later add an "Edit Banner" overlay button for the user to modify the card */}
              <div className="absolute top-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="bg-black/50 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full border border-white/20">추후 배경 이미지 편집 기능 제공 예정</span>
              </div>

              {/* Avatar Overlay replacing the Play Button */}
              <div className="avatar-container absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center justify-center opacity-90 hover:opacity-100 hover:scale-105 transition-all cursor-pointer group/avatar">
                <div className="w-20 h-20 bg-white dark:bg-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 rounded-full shadow-2xl overflow-hidden border-[0.3px] border-[#111111] relative z-10 group-hover/avatar:shadow-[0_0_30px_rgba(0,0,0,0.4)] transition-shadow">
                  <Image
                    src={profile.avatar_url || '/placeholder_avatar.png'}
                    alt="Profile Avatar"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="absolute -left-10 w-8 h-1 bg-white dark:bg-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 rounded-full opacity-80 animate-pulse" />
                <div className="absolute -right-10 w-8 h-1 bg-white dark:bg-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 rounded-full opacity-80 animate-pulse" />
                <div className="absolute -bottom-5 flex gap-1.5 z-0">
                  <div className="w-2 h-2 rounded-full bg-white dark:bg-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 opacity-100" />
                  <div className="w-2 h-2 rounded-full bg-white dark:bg-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 opacity-50" />
                  <div className="w-2 h-2 rounded-full bg-white dark:bg-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 opacity-50" />
                  <div className="w-2 h-2 rounded-full bg-white dark:bg-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 opacity-50" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Info */}
          <div className="right-container w-full md:w-[55%] p-10 md:p-14 relative flex flex-col justify-center bg-white dark:bg-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:border-neutral-800 " style={{ transform: 'translateZ(50px)' }}>
            {/* Corner Logo */}
            <div className="reveal-text absolute top-10 right-10 w-12 h-12 opacity-80">
              <Image src="/logo_icon.png" alt="BlockCanvas" fill className="object-contain" />
            </div>

            <div className="mt-4 md:mt-0">
              <h2 className="reveal-text text-5xl md:text-6xl font-black text-[#312B3B] tracking-tight mb-3">
                {profileData.display_name}
              </h2>
              <div className="reveal-text flex items-center gap-3 mb-2">
                <span className="text-2xl font-medium text-neutral-400">{footer_title || 'Block Canvas'} | {footer_subtitle || 'Creator'}</span>
              </div>
              <p className="reveal-text text-lg font-medium text-neutral-400 mb-12">
                {profileData.headline || 'Minecraft Level Designer'}
              </p>

              <div className="space-y-6 relative">

                {/* Email */}
                <div
                  onClick={() => handleCopy(profileData.contact_email, 'email')}
                  className="reveal-text flex items-center gap-5 group cursor-pointer hover:-translate-y-1 transition-transform relative w-max"
                >
                  <div className="w-12 h-12 rounded bg-neutral-100 flex items-center justify-center text-neutral-600 group-hover:bg-neutral-800 group-hover:text-white transition-colors shadow-sm relative">
                    {copiedField === 'email' ? (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="animate-in zoom-in duration-500"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-in zoom-in duration-500"><path d="M22 17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.5C2 7 4 5 6.5 5H18c2.2 0 4 1.8 4 4v8Z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /></svg>
                    )}
                    {/* Premium Tooltip */}
                    {copiedField === 'email' && (
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-neutral-900/95 backdrop-blur-sm text-white text-sm font-bold px-4 py-2 rounded-full shadow-xl whitespace-nowrap animate-in fade-in zoom-in slide-in-from-bottom-2 duration-300 pointer-events-none z-50 flex items-center gap-2 border border-white/10">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        클립보드에 복사되었습니다!                      </div>
                    )}
                  </div>
                  <span className="text-xl font-medium text-neutral-600 group-hover:text-neutral-900 dark:text-neutral-50 transition-colors">
                    {profileData.contact_email}
                  </span>
                </div>

                {/* Discord */}
                {profileData.sns_settings?.discord && profileData.discord_id && (
                  <div
                    onClick={() => handleCopy(profileData.discord_id, 'discord')}
                    className="reveal-text flex items-center gap-5 group cursor-pointer hover:-translate-y-1 transition-transform relative w-max"
                    title="디스코드 ID 복사하기"
                  >
                    <div className="w-12 h-12 rounded bg-[#5865F2] flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform relative">
                      {copiedField === 'discord' ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="animate-in zoom-in duration-300"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="animate-in zoom-in duration-300"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" /></svg>
                      )}
                      {/* Premium Tooltip */}
                      {copiedField === 'discord' && (
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-neutral-900/95 backdrop-blur-sm text-white text-sm font-bold px-4 py-2 rounded-full shadow-xl whitespace-nowrap animate-in fade-in zoom-in slide-in-from-bottom-2 duration-300 pointer-events-none z-50 flex items-center gap-2 border border-white/10">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          클립보드에 복사되었습니다!                        </div>
                      )}
                    </div>
                    <span className="text-xl font-medium text-neutral-600 group-hover:text-neutral-900 dark:text-neutral-50 transition-colors">
                      {profileData.discord_id}
                    </span>
                  </div>
                )}

                {/* YouTube */}
                {profileData.sns_settings?.youtube && profileData.youtube_url && (
                  <PreviewLinkCard href={profileData.youtube_url} asChild>
                    <a
                      href={profileData.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="reveal-text flex items-center gap-5 group cursor-pointer hover:-translate-y-1 transition-transform"
                    >
                      <div className="w-12 h-12 rounded bg-[#FF0000] flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21.582,6.186c-0.23-0.86-0.908-1.538-1.768-1.768C18.254,4,12,4,12,4S5.746,4,4.186,4.418c-0.86,0.23-1.538,0.908-1.768,1.768C2,7.746,2,12,2,12s0,4.254,0.418,5.814c0.23,0.86,0.908,1.538,1.768,1.768C5.746,20,12,20,12,20s6.254,0,7.814-0.418c0.86-0.23,1.538-0.908,1.768-1.768C22,16.254,22,12,22,12S22,7.746,21.582,6.186z M10,15.464V8.536L16,12L10,15.464z" /></svg>
                      </div>
                      <span className="text-xl font-medium text-neutral-600 group-hover:text-neutral-900 dark:text-neutral-50 transition-colors">YouTube</span>
                    </a>
                  </PreviewLinkCard>
                )}

                {/* Twitter (X) */}
                {profileData.sns_settings?.twitter && profileData.twitter_url && (
                  <PreviewLinkCard href={profileData.twitter_url} asChild>
                    <a
                      href={profileData.twitter_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="reveal-text flex items-center gap-5 group cursor-pointer hover:-translate-y-1 transition-transform"
                    >
                      <div className="w-12 h-12 rounded bg-black flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                      </div>
                      <span className="text-xl font-medium text-neutral-600 group-hover:text-neutral-900 dark:text-neutral-50 transition-colors">X (Twitter)</span>
                    </a>
                  </PreviewLinkCard>
                )}

                {/* Instagram */}
                {profileData.sns_settings?.instagram && profileData.instagram_url && (
                  <PreviewLinkCard href={profileData.instagram_url} asChild>
                    <a
                      href={profileData.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="reveal-text flex items-center gap-5 group cursor-pointer hover:-translate-y-1 transition-transform"
                    >
                      <div className="w-12 h-12 rounded bg-gradient-to-tr from-[#f09433] via-[#e6683c] to-[#bc1888] flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
                      </div>
                      <span className="text-xl font-medium text-neutral-600 group-hover:text-neutral-900 dark:text-neutral-50 transition-colors">Instagram</span>
                    </a>
                  </PreviewLinkCard>
                )}                {/* Patreon */}
                {profileData.sns_settings?.patreon && profileData.patreon_url && (
                  <PreviewLinkCard href={profileData.patreon_url} asChild>
                    <a
                      href={profileData.patreon_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="reveal-text flex items-center gap-5 group cursor-pointer hover:-translate-y-1 transition-transform"
                    >
                      <div className="w-12 h-12 rounded bg-black flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
                        <svg width="20" height="20" viewBox="0 0 569 546" fill="currentColor"><path d="M360.141 0c-115.115 0-208.435 93.32-208.435 208.434 0 115.115 93.32 208.434 208.434 208.434 115.114 0 208.434-93.319 208.434-208.434C568.575 93.32 475.255 0 360.141 0zM0 545.474h94.947V0H0v545.474z" /></svg>
                      </div>
                      <span className="text-xl font-medium text-neutral-600 group-hover:text-neutral-900 dark:text-neutral-50 transition-colors">Patreon</span>
                    </a>
                  </PreviewLinkCard>
                )}
              </div>
            </div>
          </div>
          {/* End of Revealed Content Wrapper */}
        </div>
      </div>
    </section>

    {/* Footer Reveal */}
    <div className={`w-full transition-all duration-1000 ease-out origin-top ${isRevealed ? 'opacity-100 scale-y-100 max-h-[1000px]' : 'opacity-0 scale-y-0 max-h-0 overflow-hidden'}`}>
      <CreatorFooter profileData={profileData} creatorName={profile.creator_name} />
    </div>
    </>
  )
}