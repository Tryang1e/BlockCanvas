'use client'

import React, { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { submitContactMessage } from '@/app/actions/contact'
import { ArrowRight, Sparkles, Move, Users, Award, Shield, Cpu, Compass } from 'lucide-react'

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
  const [isPending, startTransition] = useTransition()
  const [formStatus, setFormStatus] = useState<{ success?: boolean; error?: string } | null>(null)
  
  // Custom precise crosshair cursor state
  const [cursorState, setCursorState] = useState<'default' | 'hover' | 'magnetic'>('default')

  // Top level DOM Refs
  const mainContainerRef = useRef<HTMLDivElement>(null)
  const customCursorRef = useRef<HTMLDivElement>(null)
  const cursorRingRef = useRef<HTMLDivElement>(null)
  const cursorCrosshairRef = useRef<HTMLDivElement>(null)

  // Dynamic Workspace Page Alignments
  const mainHeroRef = useRef<HTMLElement>(null)
  const interactiveCanvasRef = useRef<HTMLElement>(null)
  const staffPanelRef = useRef<HTMLElement>(null)
  const statsContainerRef = useRef<HTMLDivElement>(null)
  const inquirySectionRef = useRef<HTMLElement>(null)
  const inquiryBoxRef = useRef<HTMLDivElement>(null)

  // Floating Draggable Mockups (aligned with the creator portfolio card aesthetic)
  const dragContainerRef = useRef<HTMLDivElement>(null)
  const floatingBlockRefs = useRef<(HTMLDivElement | null)[]>([])
  
  const heroZoomImgRef = useRef<HTMLDivElement>(null)
  const milestoneRefs = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const cursor = customCursorRef.current
    const ring = cursorRingRef.current
    const cross = cursorCrosshairRef.current

    // 1. Dynamic kinetic custom cursor
    const onMouseMove = (e: MouseEvent) => {
      if (cursor) {
        gsap.to(cursor, {
          x: e.clientX,
          y: e.clientY,
          duration: 0.05,
          ease: 'power2.out'
        })
      }
    }
    window.addEventListener('mousemove', onMouseMove, { passive: true })

    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight
      if (totalScroll > 0) {
        setScrollProgress((window.scrollY / totalScroll) * 100)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })

    // 2. High-performance Magnetic Effect (creator page DNA)
    const magneticElements = document.querySelectorAll('.magnetic-target')
    magneticElements.forEach((el) => {
      const onMouseEnter = () => {
        setCursorState('magnetic')
        gsap.to(ring, { scale: 2.2, borderColor: '#1A1A1A', backgroundColor: 'rgba(26,26,26,0.06)', duration: 0.3 })
        gsap.to(cross, { opacity: 1, scale: 1, rotate: 45, duration: 0.4, ease: 'back.out(2)' })
      }
      const onMouseLeave = () => {
        setCursorState('default')
        gsap.to(ring, { scale: 1, borderColor: 'rgba(26,26,26,0.3)', backgroundColor: 'transparent', duration: 0.3 })
        gsap.to(cross, { opacity: 0, scale: 0.5, rotate: 0, duration: 0.3 })
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
      el.addEventListener('mouseenter', onMouseEnter)
      el.addEventListener('mouseleave', onMouseLeave)
      el.addEventListener('mousemove', onMouseMoveMagnetic as any)
    })

    // 3. Hero Monolith visual alignment
    if (mainHeroRef.current) {
      const heroTl = gsap.timeline({
        scrollTrigger: {
          trigger: mainHeroRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
          pin: true,
          pinSpacing: true
        }
      })

      if (heroZoomImgRef.current) {
        heroTl.to(heroZoomImgRef.current, {
          scale: 0.84,
          borderRadius: '32px',
          duration: 1.5,
          ease: 'power2.inOut'
        }, 0)
      }

      const title = mainHeroRef.current.querySelector('.hero-kinetic-title')
      const tag = mainHeroRef.current.querySelector('.hero-kinetic-tag')
      if (title && tag) {
        heroTl.to(title, { yPercent: -15, scale: 0.94, opacity: 0.2, duration: 1.2 }, 0)
        heroTl.to(tag, { yPercent: 15, opacity: 0, duration: 0.8 }, 0)
      }
    }

    // 4. Interactive Drag Sandbox logic (aligned with creator's DraggablePortfolio)
    floatingBlockRefs.current.forEach((block) => {
      if (!block) return

      let isDragging = false
      let startX = 0
      let startY = 0
      let currentX = 0
      let currentY = 0

      // Natural spread positions
      const initX = (Math.random() - 0.5) * 240
      const initY = (Math.random() - 0.5) * 160
      const initRotate = (Math.random() - 0.5) * 12
      
      gsap.set(block, { x: initX, y: initY, rotate: initRotate })

      const onMouseDown = (e: MouseEvent) => {
        isDragging = true
        startX = e.clientX - currentX
        startY = e.clientY - currentY
        block.style.cursor = 'grabbing'
        block.style.zIndex = '35'
        gsap.to(block, { scale: 1.04, rotate: initRotate + 4, boxShadow: '0 30px 60px -15px rgba(0,0,0,0.2)', duration: 0.3 })
      }

      const onMouseMoveDrag = (e: MouseEvent) => {
        if (!isDragging) return
        currentX = e.clientX - startX
        currentY = e.clientY - startY
        gsap.set(block, { x: currentX, y: currentY })
      }

      const onMouseUp = () => {
        if (!isDragging) return
        isDragging = false
        block.style.cursor = 'grab'
        block.style.zIndex = '30'
        gsap.to(block, { scale: 1.0, rotate: initRotate, boxShadow: '0 15px 30px -5px rgba(0,0,0,0.08)', duration: 0.4, ease: 'back.out(1.4)' })
      }

      block.addEventListener('mousedown', onMouseDown)
      window.addEventListener('mousemove', onMouseMoveDrag)
      window.addEventListener('mouseup', onMouseUp)
    })

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

    // 6. Artists Card Entrance Animation
    if (staffPanelRef.current) {
      const cards = staffPanelRef.current.querySelectorAll('.artist-cinema-card')
      cards.forEach((card) => {
        gsap.fromTo(card,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 90%',
              toggleActions: 'play none none reverse'
            }
          }
        )
      })
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('scroll', handleScroll)
      ScrollTrigger.getAll().forEach(trigger => trigger.kill())
    }
  }, [creators])

  // Handle cooperation inquiry submit
  const handleInquirySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormStatus(null)
    
    const formData = new FormData(e.currentTarget)
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const message = formData.get('message') as string

    if (!name || !email || !message) {
      setFormStatus({ error: '모든 항목을 기재해 주십시오.' })
      return
    }

    startTransition(async () => {
      const targetName = creators[0]?.creator_name || 'steve_builder'
      const res = await submitContactMessage(targetName, { name, email, message })
      
      if (res.success) {
        setFormStatus({ success: true })
        const form = document.getElementById('inquiry-form') as HTMLFormElement
        if (form) form.reset()
      } else {
        setFormStatus({ error: res.error || '송신 중 오류가 발생했습니다.' })
      }
    })
  }

  const demoCreators = creators.length > 0 ? creators : [
    {
      id: 'staff-1',
      creator_name: 'steve_builder',
      display_name: 'Steve Buildmaster',
      avatar_url: null,
      role: 'creator',
      portfolios: {
        headline: 'Chief Spatial & Monolith Architect',
        about_text: '웅장한 천상 제국 돔 성곽 및 판타지 요새 총괄 설계 담당 주석 아티스트',
        theme_bg_color: '#B5A28C',
        theme_bg_effect: 'none'
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
        about_text: '한 칸의 오차도 없는 완벽한 하이테크 미래 메트로폴리스 도시 구획 감독',
        theme_bg_color: '#4B3F72',
        theme_bg_effect: 'none'
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
        about_text: '인게임 거대 3D 입체 조형물 및 자산 모듈 총괄 관리 이사',
        theme_bg_color: '#2A9D8F',
        theme_bg_effect: 'none'
      }
    }
  ] as any[]

  return (
    <div 
      ref={mainContainerRef}
      className="min-h-screen bg-[#FAF9F5] text-[#1E2022] font-sans overflow-x-hidden selection:bg-black selection:text-white relative cursor-none w-full"
    >
      
      {/* 🎯 Custom precise tracking reticle cursor */}
      <div 
        ref={customCursorRef}
        className="fixed w-6 h-6 pointer-events-none z-50 -translate-x-1/2 -translate-y-1/2 hidden md:block"
        style={{ transform: 'translate3d(-100px, -100px, 0)' }}
      >
        <div 
          ref={cursorRingRef}
          className="absolute inset-0 rounded-full border border-black/30 transition-transform duration-300 ease-out" 
        />
        <div className="absolute inset-2 bg-black rounded-full scale-[0.4]" />
        
        <div 
          ref={cursorCrosshairRef}
          className="absolute inset-0 opacity-0 scale-50 transition-all duration-300 ease-out pointer-events-none"
        >
          <div className="absolute top-0 bottom-0 left-[50%] w-[1px] bg-black/40" />
          <div className="absolute left-0 right-0 top-[50%] h-[1px] bg-black/40" />
        </div>
      </div>

      {/* Top thin progress scroll tracking bar */}
      <div 
        className="fixed top-0 left-0 h-[3px] bg-black z-50 transition-all duration-100 ease-out" 
        style={{ width: `${scrollProgress}%` }}
      />

      {/* 🏛️ Pure Minimal Translucent Header Bar */}
      <header className="fixed top-0 left-0 right-0 z-45 bg-[#FAF9F5]/75 backdrop-blur-md border-b border-neutral-200/40 py-5 w-full">
        <div className="w-full px-6 md:px-12 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group magnetic-target">
            <div className="relative w-5 h-5 transition-transform duration-500 group-hover:rotate-90">
              <Image src="/logo_icon.png" alt="BlockCanvas Logo" fill className="object-contain" />
            </div>
            <span className="font-extrabold text-sm tracking-widest uppercase text-black">
              BLOCKCANVAS
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
            <a href="#hero-section" className="hover:text-black transition-colors magnetic-target">시네마틱</a>
            <a href="#interactive-canvas" className="hover:text-black transition-colors magnetic-target">캔버스 시뮬레이터</a>
            <a href="#staff-section" className="hover:text-black transition-colors magnetic-target">빌더 길드</a>
            <a href="#cooperation-section" className="hover:text-black transition-colors magnetic-target">공식 협업</a>
          </nav>

          <div>
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
        className="relative h-[100vh] w-full bg-[#FAF9F5] flex items-center justify-center overflow-hidden z-20 border-b border-neutral-200"
      >
        {/* Dynamic Space Particles background aligned with creator portfolios */}
        <div className="absolute inset-0 bg-neutral-950 z-0">
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div 
            ref={heroZoomImgRef}
            className="absolute inset-0 w-full h-full overflow-hidden origin-center"
          >
            <Image 
              src="/example3.png" 
              alt="BlockCanvas Cinematic Monolith" 
              fill 
              className="object-cover brightness-75 opacity-75"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#FAF9F5]/10 via-transparent to-[#FAF9F5]" />
          </div>
        </div>

        <div className="relative z-20 w-full px-6 md:px-12 flex flex-col items-center text-center">
          <div className="hero-kinetic-tag inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-neutral-200 text-black text-[8px] font-bold uppercase tracking-widest mb-6 select-none rounded-full shadow-sm">
            <Sparkles size={10} className="text-yellow-500 animate-pulse" />
            <span>THE ULTIMATE PORTFOLIO BUILDER ENGINE</span>
          </div>

          <h1 className="hero-kinetic-title text-6xl md:text-9xl lg:text-[10rem] font-black tracking-tighter leading-[0.85] uppercase text-white select-none drop-shadow-lg">
            BLOCKCANVAS
          </h1>
        </div>
      </section>

      {/* 📊 STAGE 2: Stats Grid Panel */}
      <section 
        ref={statsContainerRef} 
        className="py-12 bg-[#FAF9F5] border-b border-neutral-200 w-full px-6 md:px-12 relative z-20"
      >
        <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="flex flex-col items-start p-4 border-l border-neutral-200 text-left">
            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-2">Block Volume</span>
            <span ref={(el) => { milestoneRefs.current[0] = el }} className="text-2xl md:text-3xl font-extrabold text-black font-mono">0+</span>
          </div>

          <div className="flex flex-col items-start p-4 border-l border-neutral-200 text-left">
            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-2">Lead Architects</span>
            <span ref={(el) => { milestoneRefs.current[1] = el }} className="text-2xl md:text-3xl font-extrabold text-black font-mono">0+</span>
          </div>

          <div className="flex flex-col items-start p-4 border-l border-neutral-200 text-left">
            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-2">Citadels Built</span>
            <span ref={(el) => { milestoneRefs.current[2] = el }} className="text-2xl md:text-3xl font-extrabold text-black font-mono">0+</span>
          </div>

          <div className="flex flex-col items-start p-4 border-l border-neutral-200 text-left">
            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-2">Contract Rate</span>
            <span ref={(el) => { milestoneRefs.current[3] = el }} className="text-2xl md:text-3xl font-extrabold text-black font-mono">0%</span>
          </div>
        </div>
      </section>

      {/* 🎡 STAGE 3: 진짜 크리에이터 페이지의 "드래그 감성"과 100% 매칭시킨 "인터랙티브 블루프린트 캔버스" */}
      <section 
        id="interactive-canvas"
        ref={interactiveCanvasRef}
        className="w-full min-h-[105vh] bg-[#FAF9F5] py-24 px-6 md:px-12 relative overflow-hidden z-20 border-b border-neutral-200 flex flex-col justify-between"
      >
        {/* Dynamic deep space visual alignment grid inside interactive canvas */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1.5px, transparent 1.5px)', backgroundSize: '36px 36px' }} />

        <div className="w-full text-left z-30 relative max-w-4xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-neutral-200 text-neutral-600 text-[8px] font-bold uppercase tracking-widest mb-4 rounded-full shadow-sm">
            <Cpu size={10} className="text-black" />
            <span>INTERACTIVE WORKSPACE SIMULATOR</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-black text-black uppercase tracking-tighter leading-tight">
            당신의 포트폴리오를<br />자유롭게 드래그하세요.
          </h2>
          <p className="text-[11px] md:text-xs text-neutral-400 font-mono mt-3 uppercase tracking-wider block">
            [ MOUSE DRAG THE BLOCKS BELOW TO BUILD YOUR UNIQUE LANDSCAPE ]
          </p>
        </div>

        {/* Dynamic Sandbox area matching creator portfolio theme parameters */}
        <div 
          ref={dragContainerRef}
          className="w-full flex-1 min-h-[55vh] relative flex items-center justify-center my-12"
        >
          {/* Draggable Block Card 1 */}
          <div 
            ref={(el) => { floatingBlockRefs.current[0] = el }}
            className="absolute w-[240px] md:w-[320px] bg-white border border-neutral-200 p-4 shadow-xl select-none cursor-grab active:cursor-grabbing hover:border-black transition-colors duration-300 z-30 rounded-2xl"
          >
            <div className="relative w-full aspect-video bg-neutral-900 overflow-hidden rounded-xl mb-3 border border-neutral-100">
              <Image src="/example1.png" alt="Steve Works" fill className="object-cover pointer-events-none" />
            </div>
            <div className="flex justify-between items-center border-t border-neutral-100 pt-3 text-left">
              <div>
                <span className="text-[8px] font-bold text-neutral-400 font-mono">01 / LANDSCAPE</span>
                <h4 className="text-[11.5px] font-extrabold text-black uppercase">발할라 황실 성당</h4>
              </div>
              <Link href="/creator/steve_builder" className="text-[8px] font-bold text-white bg-black px-2.5 py-1.5 hover:bg-neutral-800 transition-colors rounded-lg">
                VIEW
              </Link>
            </div>
            <div className="absolute top-2 right-2 flex items-center gap-1 text-[7px] font-bold bg-white/90 border border-neutral-200 px-1.5 py-0.5 rounded-full text-neutral-600 shadow-sm pointer-events-none">
              <Move size={8} />
              <span>DRAG</span>
            </div>
          </div>

          {/* Draggable Block Card 2 */}
          <div 
            ref={(el) => { floatingBlockRefs.current[1] = el }}
            className="absolute w-[240px] md:w-[320px] bg-white border border-neutral-200 p-4 shadow-xl select-none cursor-grab active:cursor-grabbing hover:border-black transition-colors duration-300 z-30 rounded-2xl"
          >
            <div className="relative w-full aspect-video bg-neutral-900 overflow-hidden rounded-xl mb-3 border border-neutral-100">
              <Image src="/example2.png" alt="Alex Works" fill className="object-cover pointer-events-none" />
            </div>
            <div className="flex justify-between items-center border-t border-neutral-100 pt-3 text-left">
              <div>
                <span className="text-[8px] font-bold text-neutral-400 font-mono">02 / CYBERPUNK</span>
                <h4 className="text-[11.5px] font-extrabold text-black uppercase">사이버 넥서스 시티</h4>
              </div>
              <Link href="/creator/level_designer_x" className="text-[8px] font-bold text-white bg-black px-2.5 py-1.5 hover:bg-neutral-800 transition-colors rounded-lg">
                VIEW
              </Link>
            </div>
            <div className="absolute top-2 right-2 flex items-center gap-1 text-[7px] font-bold bg-white/90 border border-neutral-200 px-1.5 py-0.5 rounded-full text-neutral-600 shadow-sm pointer-events-none">
              <Move size={8} />
              <span>DRAG</span>
            </div>
          </div>

          {/* Draggable Block Card 3 */}
          <div 
            ref={(el) => { floatingBlockRefs.current[2] = el }}
            className="absolute w-[240px] md:w-[320px] bg-white border border-neutral-200 p-4 shadow-xl select-none cursor-grab active:cursor-grabbing hover:border-black transition-colors duration-300 z-30 rounded-2xl"
          >
            <div className="relative w-full aspect-video bg-neutral-900 overflow-hidden rounded-xl mb-3 border border-neutral-100">
              <Image src="/example4.png" alt="Pixel Works" fill className="object-cover pointer-events-none" />
            </div>
            <div className="flex justify-between items-center border-t border-neutral-100 pt-3 text-left">
              <div>
                <span className="text-[8px] font-bold text-neutral-400 font-mono">03 / VOXEL MUSEUM</span>
                <h4 className="text-[11.5px] font-extrabold text-black uppercase">복셀 도트 미술관</h4>
              </div>
              <Link href="/creator/mc_pixel_art" className="text-[8px] font-bold text-white bg-black px-2.5 py-1.5 hover:bg-neutral-800 transition-colors rounded-lg">
                VIEW
              </Link>
            </div>
            <div className="absolute top-2 right-2 flex items-center gap-1 text-[7px] font-bold bg-white/90 border border-neutral-200 px-1.5 py-0.5 rounded-full text-neutral-600 shadow-sm pointer-events-none">
              <Move size={8} />
              <span>DRAG</span>
            </div>
          </div>

        </div>

        {/* Dynamic lower bar describing platform value */}
        <div className="w-full border-t border-neutral-200/80 pt-6 flex flex-col md:flex-row items-center justify-between text-neutral-400 text-[10px] font-bold font-mono">
          <span>[ BLOCKCANVAS DRAGGABLE BLUEPRINT SANDBOX V1.0 ]</span>
          <span className="mt-2 md:mt-0">[ DRAG AND INTERACT FREELY TO UNLEASH CREATIVE SPATIAL FLOW ]</span>
        </div>
      </section>

      {/* 👥 STAGE 4: Guild Architects (수석 빌더 3열 정렬 시네마틱 보드) */}
      <section 
        id="staff-section" 
        ref={staffPanelRef}
        className="py-24 bg-[#F5F4F0] w-full relative z-20 border-b border-neutral-200"
      >
        <div className="w-full px-6 md:px-12 text-left mb-16">
          <span className="text-neutral-400 text-[9px] font-bold uppercase tracking-widest mb-2 block flex items-center gap-1.5">
            <Users size={11} />
            <span>GUILD ARCHITECTS</span>
          </span>
          <h2 className="text-2xl md:text-4xl font-extrabold text-black tracking-tight uppercase">
            수석 빌더 스태프
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 w-full border-y border-neutral-200 bg-white">
          {demoCreators.map((creator, index) => {
            const snapshotImages = ['/example1.png', '/example2.png', '/example4.png']
            const currentSnapshot = snapshotImages[index % snapshotImages.length]

            return (
              <div
                key={creator.id}
                className="artist-cinema-card bg-white border-b md:border-b-0 md:border-r border-neutral-200 overflow-hidden flex flex-col justify-between aspect-[1/1] hover:bg-neutral-50/70 transition-colors w-full p-8 md:p-12 last:border-r-0"
              >
                <div className="w-full h-56 bg-neutral-900 relative overflow-hidden mb-6 border border-neutral-200/80 rounded-2xl">
                  <Image 
                    src={currentSnapshot} 
                    alt={`${creator.display_name} 대표작 스냅`} 
                    fill 
                    className="object-cover brightness-95"
                  />
                  <span className="absolute bottom-3 left-3 px-2 py-0.5 bg-black/85 text-white text-[8px] font-bold font-mono tracking-widest rounded-full">
                    SNAP 0{index + 1}
                  </span>
                </div>

                <div className="flex flex-col justify-between flex-1 text-left">
                  <div>
                    <p className="text-sm font-extrabold text-black">{creator.display_name}</p>
                    <p className="text-[10px] text-neutral-400 font-mono mt-0.5">@{creator.creator_name}</p>
                  </div>

                  <div className="pt-4 border-t border-neutral-200/50 flex items-center justify-between mt-4">
                    <span className="text-[9px] text-neutral-400 font-mono font-bold">GUILD STAFF</span>
                    <Link 
                      href={`/creator/${creator.creator_name}`}
                      className="text-[10px] font-extrabold text-black hover:text-neutral-500 transition-colors inline-flex items-center gap-1.5 magnetic-target"
                    >
                      <span>EXPLORE CANVAS</span>
                      <ArrowRight size={10} />
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* 📬 STAGE 5: Cooperation Form */}
      <section 
        id="cooperation-section"
        ref={inquirySectionRef}
        className="py-24 w-full px-6 md:px-12 bg-white relative z-20"
      >
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          
          <div className="lg:col-span-5 text-left pr-4">
            <span className="text-neutral-400 text-[9px] font-bold uppercase tracking-widest mb-2 block flex items-center gap-1.5">
              <Award size={12} />
              <span>OFFICIAL REQUEST</span>
            </span>
            <h2 className="text-2xl md:text-4xl font-extrabold text-black mb-6 tracking-tight leading-tight uppercase">
              프로젝트 의뢰
            </h2>
            <p className="text-[11px] md:text-xs text-neutral-500 leading-relaxed font-semibold">
              메타버스 빌딩 시공, 공간 브랜딩 제휴 등 BlockCanvas 와의 공식 협업을 희망하시는 경우 양식을 송신해 주십시오. 48시간 이내에 회신해 드립니다.
            </p>
          </div>

          <div 
            ref={inquiryBoxRef}
            className="lg:col-span-7 bg-[#FAF9F5] border border-neutral-200 p-8 md:p-12 shadow-sm text-left w-full rounded-2xl"
          >
            <form id="inquiry-form" onSubmit={handleInquirySubmit} className="flex flex-col gap-6 w-full">
              
              <div>
                <label className="text-[8px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                  의뢰인 이름 / 회사명
                </label>
                <input 
                  type="text" 
                  name="name"
                  placeholder="예: 마이크로소프트 코리아 관계자"
                  className="w-full text-xs p-3 border border-neutral-200 focus:border-black focus:outline-none bg-white text-black font-mono rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="text-[8px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                  이메일 주소
                </label>
                <input 
                  type="email" 
                  name="email"
                  placeholder="contact@company.com"
                  className="w-full text-xs p-3 border border-neutral-200 focus:border-black focus:outline-none bg-white text-black font-mono rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="text-[8px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                  의뢰 목적 및 세부 설명
                </label>
                <textarea 
                  name="message"
                  rows={4}
                  placeholder="의뢰 목적 및 스케일을 기재해 주십시오."
                  className="w-full text-xs p-3 border border-neutral-200 focus:border-black focus:outline-none bg-white text-black resize-none rounded-lg"
                  required
                />
              </div>

              {formStatus && (
                <div className={`p-3 text-[10px] md:text-xs font-bold rounded-lg ${formStatus.success ? 'bg-neutral-900 text-white' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                  {formStatus.success ? '🎉 의뢰서가 송신되었습니다.' : formStatus.error}
                </div>
              )}

              <button 
                type="submit"
                disabled={isPending}
                className="py-4 bg-black text-white hover:bg-neutral-800 font-bold text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 disabled:bg-neutral-400 magnetic-target rounded-xl"
              >
                <span>{isPending ? 'TRANSMITTING...' : 'SEND INQUIRY'}</span>
              </button>

            </form>
          </div>

        </div>
      </section>

      {/* 🖤 Geometric Black Footer (푸터만 블랙 톤 허용) */}
      <footer className="w-full bg-black py-20 px-6 md:px-12 text-neutral-500 border-t border-black relative z-10">
        <div className="w-full flex flex-col md:flex-row items-center justify-between">
          <div className="flex flex-col gap-2 mb-10 md:mb-0 text-center md:text-left">
            <span className="font-extrabold text-sm tracking-widest text-white uppercase">BLOCKCANVAS</span>
            <p className="text-[#666666] text-[9px] font-bold">© 2026 BlockCanvas Studio. All rights reserved.</p>
          </div>

          <div className="flex gap-8 text-[9px] text-[#888888] font-bold">
            <Link href="/login" className="hover:text-white transition-colors magnetic-target">로그인</Link>
            <Link href="/creator/steve_builder" className="hover:text-white transition-colors magnetic-target">데모 사이트</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
