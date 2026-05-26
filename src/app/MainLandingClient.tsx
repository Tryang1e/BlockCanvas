'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Sparkles, Move, Users, Shield, Cpu, Compass, ArrowUp, Mail } from 'lucide-react'
import InfiniteMarquee from '@/components/ui/InfiniteMarquee'
import CustomCursor from '@/components/ui/CustomCursor'

// Import GSAP safely
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

interface CreatorProfile {
  id: string;
  creator_name: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
  portfolios: {
    headline: string | null;
    about_text: string | null;
    theme_bg_color: string | null;
    theme_bg_effect: string | null;
  } | null;
}

interface Props {
  creators: CreatorProfile[];
}

export default function MainLandingClient({ creators }: Props) {
  const [scrollProgress, setScrollProgress] = useState(0)

  // Track active slide index for vertical side dot navigation
  const [currentIdx, setCurrentIdx] = useState(0)
  const currentIdxRef = useRef(0)

  // Drawer-style Overlay Pop/Push Footer States
  const [showFooterPopup, setShowFooterPopup] = useState(false)
  const showFooterPopupRef = useRef(false)
  const toggleFooterPopup = (val: boolean) => {
    setShowFooterPopup(val)
    showFooterPopupRef.current = val
  }

  // Top level DOM Refs
  const mainContainerRef = useRef<HTMLDivElement>(null)

  // Dynamic Workspace Page Alignments
  const mainHeroRef = useRef<HTMLElement>(null)
  const staffPanelRef = useRef<HTMLElement>(null)
  const statsContainerRef = useRef<HTMLDivElement>(null)

  const heroZoomImgRef = useRef<HTMLDivElement>(null)
  const milestoneRefs = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1. Scroll progress listener
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight
      if (totalScroll > 0) {
        setScrollProgress((window.scrollY / totalScroll) * 100)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })

    // 2. High-performance Magnetic Effect (creator page DNA)
    const magneticElements = document.querySelectorAll('.magnetic-target')
    const magneticHandlers: { el: Element; leave: () => void; move: (e: MouseEvent) => void }[] = []

    magneticElements.forEach((el) => {
      const onMouseLeave = () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: 'power2.out' })
      }
      const onMouseMoveMagnetic = (e: MouseEvent) => {
        const rect = el.getBoundingClientRect()
        const x = e.clientX - rect.left - rect.width / 2
        const y = e.clientY - rect.top - rect.height / 2
        gsap.to(el, {
          x: x * 0.4,
          y: y * 0.4,
          duration: 0.2,
          ease: 'power2.out'
        })
      }
      el.addEventListener('mouseleave', onMouseLeave)
      el.addEventListener('mousemove', onMouseMoveMagnetic as any)
      magneticHandlers.push({ el, leave: onMouseLeave, move: onMouseMoveMagnetic })
    })

    // 3. Hero Monolith visual alignment
    if (mainHeroRef.current) {
      // Enable 3D perspective context
      gsap.set(mainHeroRef.current, { perspective: 1200 })

      const heroTl = gsap.timeline({
        scrollTrigger: {
          trigger: mainHeroRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
          pin: false
        }
      })

      if (heroZoomImgRef.current) {
        heroTl.to(heroZoomImgRef.current, {
          scale: 0.8,
          rotateX: 12,
          rotateY: -4,
          y: 60,
          borderRadius: '40px',
          boxShadow: '0 50px 100px -20px rgba(0,0,0,0.12)',
          duration: 1.5,
          ease: 'power2.inOut'
        }, 0)
      }

      const grid = mainHeroRef.current.querySelector('.hero-bg-grid')
      if (grid) {
        heroTl.to(grid, {
          scale: 1.15,
          opacity: 0.6,
          duration: 1.5,
          ease: 'power2.inOut'
        }, 0)
      }

      const title = mainHeroRef.current.querySelector('.hero-kinetic-title')
      const tag = mainHeroRef.current.querySelector('.hero-kinetic-tag')
      if (title) {
        heroTl.to(title, {
          yPercent: -40,
          scale: 0.85,
          rotateX: -15,
          opacity: 0,
          duration: 1.2,
          ease: 'power1.inOut'
        }, 0)
      }
      if (tag) {
        heroTl.to(tag, {
          yPercent: -20,
          opacity: 0,
          duration: 0.8,
          ease: 'power1.in'
        }, 0)
      }
    }



    // 5. Dynamic Stats Counter
    if (statsContainerRef.current) {
      const statsTargets = [84200000, 12, 45, 100]
      milestoneRefs.current.forEach((ref, index) => {
        if (ref) {
          const targetVal = statsTargets[index]
          const obj = { value: 0 }

          gsap.to(obj, {
            value: targetVal,
            scrollTrigger: {
              trigger: statsContainerRef.current,
              start: 'top 88%',
              once: true
            },
            duration: 2.8,
            ease: 'power3.out',
            onUpdate: () => {
              if (index === 0) {
                ref.innerText = Math.floor(obj.value).toLocaleString() + '+'
              } else if (index === 3) {
                ref.innerText = Math.floor(obj.value) + '%'
              } else {
                ref.innerText = Math.floor(obj.value) + '+'
              }
            }
          })
        }
      })
    }

    // 6. Artists Panel Entrance Animation
    if (staffPanelRef.current) {
      const header = staffPanelRef.current.querySelector('div')
      const track = staffPanelRef.current.querySelector('.my-auto') || staffPanelRef.current.querySelector('.py-6') || staffPanelRef.current.querySelector('.py-8')
      if (header && track) {
        gsap.fromTo(header,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: header, start: 'top 85%' } }
        )
        gsap.fromTo(track,
          { opacity: 0, scale: 0.96 },
          { opacity: 1, scale: 1, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: track, start: 'top 85%' } }
        )
      }
    }

    // 7. About Section Entrance Animation
    const aboutSection = document.getElementById('about-section')
    if (aboutSection) {
      const watermark = aboutSection.querySelector('.about-watermark')
      const content = aboutSection.querySelector('.about-content-box')

      if (watermark && content) {
        gsap.fromTo(watermark,
          { opacity: 0, x: -50 },
          {
            opacity: 0.02,
            x: 0,
            duration: 1.5,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: aboutSection,
              start: 'top 80%',
              toggleActions: 'play none none reverse'
            }
          }
        )

        gsap.fromTo(content,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 1.2,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: aboutSection,
              start: 'top 75%',
              toggleActions: 'play none none reverse'
            }
          }
        )
      }
    }

    // --- 8. Premium Slide Scrolling Controller (pixelnetwork.kr-style slide-by-slide transitions) ---
    const sections = ['#hero-section', '#about-section', '#staff-section']
    let isAnimating = false
    let startY = 0

    const scrollToIdx = (idx: number) => {
      if (idx < 0 || idx >= sections.length || isAnimating) return
      isAnimating = true
      currentIdxRef.current = idx
      setCurrentIdx(idx)

      const target = document.querySelector(sections[idx]) as HTMLElement
      if (target) {
        const targetTop = target.getBoundingClientRect().top + window.scrollY
        window.scrollTo({
          top: targetTop,
          behavior: 'smooth'
        })
      }

      // Lock scroll gestures during smooth sweep transition (1000ms)
      setTimeout(() => {
        isAnimating = false
      }, 1000)
    }

      // Expose scrollToIdx for JSX elements (side indicators & footer circular button)
      ; (window as any).scrollToLandingIdx = scrollToIdx

    // Wheel listener (non-passive to allow preventDefault)
    const handleWheelEvent = (e: WheelEvent) => {
      e.preventDefault()
      if (isAnimating) return

      // Last section (#staff-section) Pop/Push Drawer logic
      if (currentIdxRef.current === 2) {
        if (e.deltaY > 15) {
          // Downward wheel: Pop footer up if hidden
          if (!showFooterPopupRef.current) {
            toggleFooterPopup(true)
            return
          }
        } else if (e.deltaY < -15) {
          // Upward wheel: Push footer down first
          if (showFooterPopupRef.current) {
            toggleFooterPopup(false)
            return
          }
          // If footer is hidden, snap back to Stage 2
          scrollToIdx(1)
          return
        }
        return // Trap wheel actions within staff section while transitioning
      }

      if (e.deltaY > 15) {
        scrollToIdx(currentIdxRef.current + 1)
      } else if (e.deltaY < -15) {
        scrollToIdx(currentIdxRef.current - 1)
      }
    }

    // Touch handlers to capture mobile swipe gestures
    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY
    }

    const handleTouchMove = (e: TouchEvent) => {
      const diffY = startY - e.touches[0].clientY

      if (currentIdxRef.current === 2) {
        if (Math.abs(diffY) > 40) {
          e.preventDefault()
          if (isAnimating) return
          if (diffY > 0) {
            // Swipe up (scroll down) -> Pop footer
            if (!showFooterPopupRef.current) {
              toggleFooterPopup(true)
              return
            }
          } else {
            // Swipe down (scroll up) -> Push footer
            if (showFooterPopupRef.current) {
              toggleFooterPopup(false)
              return
            }
            scrollToIdx(1)
            return
          }
        }
        return
      }

      if (isAnimating) {
        e.preventDefault()
        return
      }

      if (Math.abs(diffY) > 40) {
        e.preventDefault()
        if (diffY > 0) {
          scrollToIdx(currentIdxRef.current + 1)
        } else {
          scrollToIdx(currentIdxRef.current - 1)
        }
      }
    }

    // Keydown handlers for arrow & page keys
    const handleKeyDown = (e: KeyboardEvent) => {
      const keys = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Spacebar']
      if (keys.includes(e.key)) {
        e.preventDefault()
        if (isAnimating) return

        const isDown = e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ' || e.key === 'Spacebar'

        if (currentIdxRef.current === 2) {
          if (isDown) {
            if (!showFooterPopupRef.current) {
              toggleFooterPopup(true)
            }
          } else {
            if (showFooterPopupRef.current) {
              toggleFooterPopup(false)
            } else {
              scrollToIdx(1)
            }
          }
          return
        }

        if (isDown) {
          scrollToIdx(currentIdxRef.current + 1)
        } else if (!isDown) {
          scrollToIdx(currentIdxRef.current - 1)
        }
      }
    }

    // Direct header nav click synchronization
    const navLinks = document.querySelectorAll('header nav a, header a[href^="#"]')
    const linkClickHandlers: { el: Element; handler: (e: Event) => void }[] = []

    navLinks.forEach((link) => {
      const href = link.getAttribute('href')
      const targetIdx = sections.indexOf(href || '')
      if (targetIdx !== -1) {
        const clickHandler = (e: Event) => {
          e.preventDefault()
          scrollToIdx(targetIdx)
        }
        link.addEventListener('click', clickHandler)
        linkClickHandlers.push({ el: link, handler: clickHandler })
      }
    })

    window.addEventListener('wheel', handleWheelEvent, { passive: false })
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('keydown', handleKeyDown, { passive: false })

    // Refresh ScrollTrigger to align all start/end positions perfectly with the snapping offsets
    ScrollTrigger.refresh()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('wheel', handleWheelEvent)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('keydown', handleKeyDown)

      linkClickHandlers.forEach(({ el, handler }) => {
        el.removeEventListener('click', handler)
      })

      magneticHandlers.forEach(({ el, leave, move }) => {
        el.removeEventListener('mouseleave', leave)
        el.removeEventListener('mousemove', move as any)
      })

      ScrollTrigger.getAll().forEach(trigger => trigger.kill())
      delete (window as any).scrollToLandingIdx
    }
  }, [creators])

  const mergedCreators = [
    ...creators,
    ...(creators.length < 5 ? [
      {
        id: 'staff-1',
        creator_name: 'steve_builder',
        display_name: 'Steve Buildmaster',
        avatar_url: null,
        role: 'creator',
        portfolios: {
          headline: 'Chief Spatial & Monolith Architect',
          about_text: '웅장한 천상 제국 돔 성곽 및 판타지 요새 총괄 설계 담당 주석 아티스트'
        }
      },
      {
        id: 'staff-2',
        creator_name: 'level_designer_x',
        display_name: 'Alex Design',
        avatar_url: null,
        role: 'creator',
        portfolios: {
          headline: 'Lead Megacity Level Designer',
          about_text: '한 칸의 오차도 없는 완벽한 하이테크 미래 메트로폴리스 도시 구획 감독'
        }
      },
      {
        id: 'staff-3',
        creator_name: 'mc_pixel_art',
        display_name: 'PixelCraft',
        avatar_url: null,
        role: 'creator',
        portfolios: {
          headline: 'Asset Architecture Director',
          about_text: '인게임 거대 3D 입체 조형물 및 자산 모듈 총괄 관리 이사'
        }
      }
    ] : [])
  ] as any[]

  return (
    <div
      ref={mainContainerRef}
      className="min-h-screen bg-[#FAF9F5] text-[#1E2022] font-sans overflow-x-hidden selection:bg-black selection:text-white relative cursor-default w-full"
    >
      {/* 📐 Premium Native CSS Scroll Snapping Engine - Delegated to high-perf JS sweep controller */}
      <style dangerouslySetInnerHTML={{
        __html: `
        html, body {
          scroll-behavior: smooth !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
        }
        .snap-section {
          height: 100vh !important;
          height: 100dvh !important;
          position: relative !important;
          overflow: hidden !important;
        }
      `}} />

      {/* 🎯 Premium Dynamic Mix-blend Custom Circle Cursor */}
      <CustomCursor />

      {/* 🧭 Premium Vertical Section Navigation Indicators */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col gap-4">
        {[
          { label: '시네마틱', idx: 0 },
          { label: '브랜드 미션', idx: 1 },
          { label: '빌더 길드', idx: 2 }
        ].map((item) => {
          const isActive = currentIdx === item.idx
          return (
            <button
              key={item.idx}
              onClick={() => {
                if (typeof window !== 'undefined' && (window as any).scrollToLandingIdx) {
                  (window as any).scrollToLandingIdx(item.idx)
                }
              }}
              className="group relative flex items-center justify-end focus:outline-none pointer-events-auto"
            >
              <span className="absolute right-8 bg-neutral-900/90 backdrop-blur-md text-white text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 pointer-events-none whitespace-nowrap shadow-md">
                {item.label}
              </span>
              <div
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all duration-300 ${isActive
                  ? 'border-2 border-black bg-transparent scale-110'
                  : 'bg-neutral-300 hover:bg-neutral-500 scale-75'
                  }`}
              >
                {isActive && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
              </div>
            </button>
          )
        })}
      </div>

      {/* Top thin progress scroll tracking bar */}
      <div
        className="fixed top-0 left-0 h-[3px] bg-black z-50 transition-all duration-100 ease-out"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* 🏛️ Pure Minimal Translucent Header Bar */}
      <header className="fixed top-0 left-0 right-0 z-[45] bg-[#FAF9F5]/75 backdrop-blur-md border-b border-neutral-200/40 py-5 w-full pointer-events-none">
        <div className="w-full px-6 md:px-12 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group magnetic-target pointer-events-auto">
            <div className="relative w-5 h-5 transition-transform duration-500 group-hover:rotate-90">
              <Image src="/logo_icon.png" alt="BlockCanvas Logo" fill className="object-contain" />
            </div>
            <span className="font-extrabold text-sm tracking-widest uppercase text-black">
              BLOCKCANVAS
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-[9px] font-bold text-neutral-400 uppercase tracking-widest pointer-events-auto">
            <a href="#hero-section" className="hover:text-black transition-colors magnetic-target">시네마틱</a>
            <a href="#about-section" className="hover:text-black transition-colors magnetic-target">브랜드 미션</a>
            <a href="#staff-section" className="hover:text-black transition-colors magnetic-target">빌더 길드</a>
          </nav>

          <div className="pointer-events-auto">
            <Link
              href="/login"
              className="text-[9px] font-bold text-neutral-400 hover:text-black transition-colors py-1.5 px-4 border border-neutral-200 bg-white hover:bg-neutral-50 magnetic-target"
            >
              로그인
            </Link>
          </div>
        </div>
      </header>

      {/* 🚀 STAGE 1: Hero Section - Extreme Wide Monolith Parallax */}
      <section
        id="hero-section"
        ref={mainHeroRef}
        className="snap-section w-full bg-[#FAF9F5] flex flex-col justify-center border-b border-neutral-200 relative overflow-hidden"
      >
        {/* Dynamic Space Particles background aligned with creator portfolios */}
        <div className="absolute inset-0 bg-[#FAF9F5] z-0">
          <div
            className="hero-bg-grid absolute inset-0 opacity-30 pointer-events-none origin-center"
            style={{ backgroundImage: 'linear-gradient(to right, #E2E2D9 1px, transparent 1px), linear-gradient(to bottom, #E2E2D9 1px, transparent 1px)', backgroundSize: '48px 48px' }}
          />
          <div
            ref={heroZoomImgRef}
            className="absolute inset-0 w-full h-full overflow-hidden origin-center"
          >
            <Image
              src="/example3.png"
              alt="BlockCanvas Cinematic Monolith"
              fill
              className="object-cover brightness-90 opacity-90"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#FAF9F5]/15 via-transparent to-[#FAF9F5]" />
          </div>
        </div>

        {/* Top spacer to account for header heights */}
        <div className="h-24 md:h-32" />

        <div className="relative z-20 w-full px-6 md:px-12 flex flex-col items-center text-center my-auto">
          <h1 className="hero-kinetic-title text-6xl md:text-9xl lg:text-[10rem] font-black tracking-tighter leading-[0.85] uppercase text-neutral-900 select-none">
            BLOCKCANVAS
          </h1>
        </div>
      </section>

      {/* 🏛️ STAGE 2.5: Brand Mission About Section (pixelnetwork.kr/#about 레이아웃 구조 차용, 디자인 톤앤매너 완벽 유지) */}
      <section
        id="about-section"
        className="snap-section w-full bg-[#FAF9F5] flex flex-col justify-center px-6 md:px-12 relative overflow-hidden z-20 border-b border-neutral-200"
      >
        {/* Dynamic Watermark Background Layer wrapped safely to prevent horizontal overflow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="about-watermark absolute top-[-5%] left-[-2%] text-[24vw] font-black text-neutral-900 opacity-[0.02] select-none tracking-tighter uppercase leading-none">
            canvas
          </div>
        </div>

        {/* CAD Blueprint grid overlay matching drawing-board aesthetic */}
        <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{ backgroundImage: 'linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="about-content-box w-full max-w-5xl mx-auto text-left relative z-10 flex flex-col justify-center items-start">
          <span className="text-neutral-400 text-[9px] font-bold uppercase tracking-widest mb-4 block flex items-center gap-1.5 font-mono">
            <Compass size={11} className="text-neutral-400 animate-spin" style={{ animationDuration: '6s' }} />
            <span>BRAND MISSION</span>
          </span>

          {/* Heading - Dynamic contrast layout matching pixelnetwork */}
          <h2 className="text-3xl md:text-5xl lg:text-[2.8rem] text-neutral-900 leading-snug tracking-tight mb-12 w-full">
            <span className="font-black text-black">크리에이터의 공간 창작물과 브랜드 가치</span>
            <span className="font-light text-neutral-400 block mt-2">를 온전히 증명하고 세상에 펼치도록.</span>
          </h2>

          {/* Core description paragraphs split layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 w-full mt-6">
            <p className="text-xs md:text-sm text-[#555555] font-normal leading-relaxed">
              BlockCanvas는 가상 공간 디자이너와 빌더들이 단순한 인게임 플레이어에 머무르지 않고, 하나의 완성된 공간 아티스트로서 온전한 가치를 인정받을 수 있는 혁신적인 포트폴리오 빌딩 엔진을 지향합니다. 크리에이터가 중심이 되어 높은 신뢰도와 상상력을 바탕으로 각 분야 최고의 마스터 빌더들이 하나로 뭉쳐있습니다.
            </p>
            <p className="text-xs md:text-sm text-[#555555] font-normal leading-relaxed">
              인게임 빌딩의 디테일한 배치와 구조를 웹 브라우저 상에 그대로 재현하고 마우스 드래그를 통해 누구나 손쉽게 공간을 편집하고 상호작용하도록 함으로써, 크리에이터에게는 온전한 브랜딩 가치를, 파트너사에게는 한 차원 높은 메타버스 브랜딩 솔루션을 긴밀하게 전달합니다.
            </p>
          </div>

          {/* Premium call-to-action buttons */}
          <div className="flex flex-row gap-4 items-center mt-12 md:mt-16 w-full pointer-events-auto">
            <Link
              href="#staff-section"
              className="rounded-full bg-neutral-900 text-[#FAF9F5] hover:bg-neutral-800 px-8 py-3.5 text-[9px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all duration-300 shadow-sm hover:shadow-lg magnetic-target"
            >
              <Users size={12} />
              <span>explore creators</span>
            </Link>

            <Link
              href="/login"
              className="rounded-full border border-neutral-900 bg-transparent text-neutral-900 hover:bg-neutral-900 hover:text-[#FAF9F5] px-8 py-3.5 text-[9px] font-bold uppercase tracking-widest transition-all duration-300 magnetic-target"
            >
              <span>start building</span>
            </Link>
          </div>
        </div>
      </section>


      {/* 👥 STAGE 4: Guild Architects (수석 빌더 스태프 - 럭셔리 마키 프로필 트랙 + 통합 푸터) */}
      <section
        id="staff-section"
        ref={staffPanelRef}
        className={`snap-section w-full bg-[#FAF9F5] flex flex-col justify-center relative overflow-hidden transform ${showFooterPopup ? '-translate-y-[80px] scale-[0.98]' : 'translate-y-0 scale-100'
          }`}
        style={{ transition: 'all 1.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="w-full px-6 md:px-12 text-left mb-12 max-w-6xl mx-auto relative z-10">
          <span className="text-neutral-400 text-[9px] font-bold uppercase tracking-widest mb-2 block flex items-center gap-1.5 font-mono">
            <Users size={11} className="text-neutral-500" />
            <span>GUILD ARCHITECTS</span>
          </span>
          <h2 className="text-2xl md:text-4xl font-extrabold text-black tracking-tight uppercase">
            BlockCanvas Creators
          </h2>
          <p className="text-[10px] md:text-xs text-neutral-400 font-mono mt-2 uppercase tracking-wider block">
            [ HOVER OVER CARDS TO PREVIEW THEIR MASTERPIECES & VIEW PORTFOLIOS ]
          </p>
        </div>

        <div className="w-full py-8 border-y border-neutral-200/60 bg-[#FAF9F5]/40 backdrop-blur-sm relative overflow-hidden z-10">
          {/* Technical Telemetry Metadata */}
          <div className="absolute top-2 left-6 text-[7px] text-neutral-400 font-mono font-bold tracking-widest uppercase z-10 pointer-events-none">
            [ TRACK STATUS: ACTIVE // SPEED: 30S_LOOP // RESOLVING_GRID: ON ]
          </div>
          <div className="absolute top-2 right-6 text-[7px] text-neutral-400 font-mono font-bold tracking-widest uppercase z-10 pointer-events-none">
            [ ACTIVE_BUILDERS: {mergedCreators.length} // LATENCY: 0.04MS ]
          </div>

          <InfiniteMarquee speed={30}>
            {mergedCreators.map((creator, index) => {
              const snapshotImages = ['/example1.png', '/example2.png', '/example4.png']
              const currentSnapshot = snapshotImages[index % snapshotImages.length]
              const initials = creator.display_name ? creator.display_name.slice(0, 2).toUpperCase() : 'BC'

              return (
                <div
                  key={creator.id}
                  className="group relative w-[310px] md:w-[350px] bg-white border border-neutral-200/70 flex flex-col rounded-[32px] transition-all duration-500 ease-out hover:border-black hover:-translate-y-2 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] overflow-hidden pointer-events-auto z-10"
                >
                  {/* Banner Image Area - Acts as the Portfolio Cover Banner (Elegant: h-[170px]) */}
                  <div className="relative w-full h-[170px] bg-neutral-100 overflow-hidden">
                    <Image
                      src={currentSnapshot}
                      alt="User Banner"
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-1000 brightness-95"
                    />

                    {/* Dark gradient mask on top of banner for tech look */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10 pointer-events-none" />

                    {/* Member sequence number at the top right */}
                    <div className="absolute top-4 right-4 text-white/50 text-[8px] font-mono font-bold">
                      #{String(index + 1).padStart(2, '0')}
                    </div>
                  </div>

                  {/* Avatar overlapping banner bottom boundary - Scaled up profile (90px) for visibility */}
                  <div className="absolute top-[130px] left-1/2 -translate-x-1/2 z-20">
                    <div className="relative w-[90px] h-[90px] rounded-full flex items-center justify-center bg-neutral-900 text-white font-black text-xl border-4 border-white shadow-[0_6px_16px_rgba(0,0,0,0.12)] group-hover:scale-105 transition-transform duration-500 overflow-hidden">
                      {creator.avatar_url ? (
                        <Image src={creator.avatar_url} alt={creator.display_name} fill className="object-cover" />
                      ) : (
                        <span>{initials}</span>
                      )}
                      {/* Interactive ring overlay */}
                      <div className="absolute inset-0 rounded-full border-2 border-white/20 opacity-0 group-hover:opacity-100 animate-spin duration-1000 pointer-events-none" style={{ animationDuration: '3s' }} />
                    </div>
                  </div>

                  {/* Content Body */}
                  <div className="pt-16 px-6 pb-6 flex flex-col justify-between flex-grow text-center">
                    <div className="mb-4">
                      <h3 className="text-lg font-black text-black tracking-tight group-hover:text-[#3b82f6] transition-colors">{creator.display_name}</h3>
                    </div>

                    {/* Premium action button at the bottom */}
                    <div className="w-full">
                      <Link
                        href={`/creator/${creator.creator_name}`}
                        className="text-[9px] font-black text-black hover:bg-neutral-900 hover:text-[#FAF9F5] transition-all inline-flex items-center gap-1 justify-center py-2.5 px-4 border border-neutral-200 rounded-full w-full hover:border-black transition-all duration-300 magnetic-target"
                      >
                        <span>EXPLORE CANVAS</span>
                        <ArrowRight size={9} className="group-hover:translate-x-0.5 transition-transform duration-300" />
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </InfiniteMarquee>
        </div>
      </section>

      <section
        id="footer-section"
        className={`fixed bottom-0 left-0 w-full bg-[#1A1A1A] border-t border-[#222222] z-40 transform ${showFooterPopup ? 'translate-y-0 opacity-100 shadow-[0_-30px_60px_rgba(0,0,0,0.4)]' : 'translate-y-full opacity-0 pointer-events-none'
          }`}
        style={{ transition: 'all 1.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <footer className="w-full text-white pt-10 pb-8 px-6 md:px-12 lg:px-24 pointer-events-auto">
          <div className="max-w-[1200px] mx-auto">

            {/* Top Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-8 mb-8 text-left">

              {/* Column 1: Support / Inquiry */}
              <div className="md:col-span-4 flex flex-col">
                <h3 className="text-[#888888] font-bold text-xs mb-6 tracking-widest uppercase">Support Canvas</h3>

                <div 
                  onClick={(e) => {
                    e.preventDefault()
                  }}
                  className="bg-transparent hover:bg-[#222222] border border-transparent hover:border-[#333333] transition-all rounded-lg p-4 flex items-center justify-between group mb-2 cursor-default select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-[#333333] flex items-center justify-center text-[#AAAAAA] group-hover:text-[#FF424D] transition-colors">
                      <Mail size={16} />
                    </div>
                    <span className="font-semibold text-xs text-[#CCCCCC] group-hover:text-white transition-colors">Contact Us</span>
                  </div>
                  <span className="text-[#666666] group-hover:text-white transition-colors">→</span>
                </div>

                <a href="mailto:support@blockcanvas.com" className="bg-transparent hover:bg-[#222222] border border-transparent hover:border-[#333333] transition-all rounded-lg p-4 flex items-center justify-between group cursor-pointer">
                  <span className="font-semibold text-xs text-[#CCCCCC] group-hover:text-white transition-colors ml-11">Business Inquiry</span>
                  <span className="text-[#666666] group-hover:text-white transition-colors">↗</span>
                </a>
              </div>

              {/* Column 2: Site Map */}
              <div className="md:col-span-3 md:col-start-6 flex flex-col">
                <h3 className="text-[#888888] font-bold text-xs mb-6 tracking-widest uppercase">Site</h3>
                <ul className="space-y-1">
                  <li>
                    <button
                      onClick={() => {
                        toggleFooterPopup(false)
                        if (typeof window !== 'undefined' && (window as any).scrollToLandingIdx) {
                          (window as any).scrollToLandingIdx(0)
                        }
                      }}
                      className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-[#222222] group transition-all text-[#CCCCCC] hover:text-white text-xs cursor-pointer focus:outline-none"
                    >
                      <span className="font-semibold">Home</span>
                      <span className="text-[#666666] group-hover:text-white transition-colors text-sm">→</span>
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => {
                        toggleFooterPopup(false)
                        if (typeof window !== 'undefined' && (window as any).scrollToLandingIdx) {
                          (window as any).scrollToLandingIdx(1)
                        }
                      }}
                      className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-[#222222] group transition-all text-[#CCCCCC] hover:text-white text-xs cursor-pointer focus:outline-none"
                    >
                      <span className="font-semibold">About Us</span>
                      <span className="text-[#666666] group-hover:text-white transition-colors text-sm">↓</span>
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => {
                        toggleFooterPopup(false)
                        if (typeof window !== 'undefined' && (window as any).scrollToLandingIdx) {
                          (window as any).scrollToLandingIdx(2)
                        }
                      }}
                      className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-[#222222] group transition-all text-[#CCCCCC] hover:text-white text-xs cursor-pointer focus:outline-none"
                    >
                      <span className="font-semibold">Creators list</span>
                      <span className="text-[#666666] group-hover:text-white transition-colors text-sm">↓</span>
                    </button>
                  </li>
                </ul>
              </div>

              {/* Column 3: Socials */}
              <div className="md:col-span-3 md:col-start-10 flex flex-col">
                <h3 className="text-[#888888] font-bold text-xs mb-6 tracking-widest uppercase">Socials</h3>
                <ul className="space-y-1">
                  <li>
                    <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-[#222222] group transition-all text-[#CCCCCC] hover:text-white text-xs cursor-pointer">
                      <span className="font-semibold">YouTube</span>
                      <span className="text-[#666666] group-hover:text-white transition-colors text-xs">↗</span>
                    </a>
                  </li>
                  <li>
                    <div
                      className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-[#222222] group transition-all text-[#CCCCCC] hover:text-white cursor-pointer text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText('BlockCanvas#0001')
                        alert('Discord ID Copied!')
                      }}
                    >
                      <span className="font-semibold">Discord</span>
                      <span className="text-[#666666] group-hover:text-white transition-colors text-[9px] font-bold uppercase">Copy ID</span>
                    </div>
                  </li>
                </ul>
              </div>
            </div>

            {/* Bottom Bar with Centered Circular Top Button */}
            <div className="flex flex-col items-center justify-center pt-6 border-t border-[#222222] relative">
              <button
                onClick={() => {
                  toggleFooterPopup(false)
                  if (typeof window !== 'undefined' && (window as any).scrollToLandingIdx) {
                    (window as any).scrollToLandingIdx(0)
                  }
                }}
                className="absolute top-[-24px] left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-white text-black flex items-center justify-center border border-[#333333] hover:bg-neutral-100 hover:scale-105 transition-all shadow-lg text-lg font-bold group z-30 cursor-pointer"
              >
                <span className="text-black group-hover:-translate-y-0.5 transition-transform duration-300 pointer-events-none">↑</span>
              </button>

              <div className="flex flex-col items-center text-center mt-4 w-full">
                <div className="flex items-center gap-2 mb-2 justify-center">
                  <div className="relative w-6 h-6 opacity-90">
                    <Image src="/logo_icon_white.png" alt="BlockCanvas Logo" fill className="object-contain" />
                  </div>
                  <span className="font-black text-base tracking-tighter text-white">BLOCKCANVAS<span className="text-[#FF424D]">.</span></span>
                </div>
                <p className="text-[#666666] text-[10px] font-medium">© 2026 BlockCanvas Studio. All rights reserved.</p>
                <p className="text-[#444444] text-[8px] mt-2 font-medium max-w-xl leading-relaxed text-center opacity-40">
                  Open Source Licenses: Next.js, React, Tailwind CSS, Framer Motion, GSAP, Prisma, Radix UI, Lucide, Lenis, Animate UI.
                </p>
              </div>
            </div>

          </div>
        </footer>
      </section>

    </div>
  )
}
