'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Sparkles, Move, Users, Shield, Cpu, Compass, ArrowUp, Mail } from 'lucide-react'
import InfiniteMarquee from '@/components/ui/InfiniteMarquee'
import BlockBuildIntro from '@/components/ui/BlockBuildIntro'
import CustomCursor from '@/components/ui/CustomCursor'
import UserSidebar from '@/components/layout/UserSidebar'
import LandingScroll from '@/components/ui/LandingScroll'
import { TransitionLink } from '@/components/ui/PixelTransition'

// Import GSAP safely
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'
import { Observer } from 'gsap/Observer'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import { attachMagnetic } from '@/lib/magnetic'

if (typeof window !== 'undefined') {
  // ScrollToPlugin 은 JumpingScrollButton 에서도 등록하지만 registerPlugin 은 멱등 —
  // 이 페이지 단독 마운트에서도 안전하도록 여기서 함께 등록한다.
  gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin, Observer, ScrollToPlugin)
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
    banner_url: string | null;
  } | null;
}

interface Props {
  creators: CreatorProfile[];
  userProfile: any;
}

export default function MainLandingClient({ creators, userProfile }: Props) {
  const [scrollProgress, setScrollProgress] = useState(0)

  // 크리에이터 서브도메인 링크 베이스. SSR과 첫 클라 렌더가 일치하도록 운영 호스트를
  // 기본값으로 두고, 마운트 후 effect 에서 실제 호스트(localhost 등)로 교체한다.
  // (ExploreClient 와 동일한 패턴 → hydration mismatch 방지)
  const [baseDomain, setBaseDomain] = useState('craftopia.work')
  const [protocol, setProtocol] = useState('https:')

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

  // 클라이언트 마운트 후 실제 호스트/프로토콜을 해석한다. 첫 렌더에는 SSR과 동일한
  // 기본값을 사용하므로 href 가 일치하고, 마운트 직후 재렌더로 로컬 호스트가 반영된다.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const host = window.location.host
    setProtocol(window.location.protocol)
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      setBaseDomain('localhost:3000')
    } else {
      const parts = host.split('.')
      setBaseDomain(parts.length >= 3 ? parts.slice(1).join('.') : host)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1. Scroll progress listener — 모션 선호와 무관하게 항상 동작
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight
      if (totalScroll > 0) {
        setScrollProgress((window.scrollY / totalScroll) * 100)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })

    // 슬라이드 대상 섹션 — 컨트롤러/사이드 도트/reduce 점프가 공용으로 참조
    const sections = ['#hero-section', '#about-section', '#staff-section']

    // LandingScroll 이 html/body 에 scroll-behavior:smooth!important 를 주입하는데,
    // 이는 scrollTop 대입(CSSOM API)까지 브라우저가 스무딩해 GSAP ScrollTo 트윈과
    // 이중 애니메이션 충돌을 일으킨다. 트윈/즉시 점프 구간에만 inline !important 로
    // auto 를 강제하고 곧바로 원복한다(상시 강제 시 about CTA 의 네이티브 앵커
    // 스무스 스크롤까지 죽으므로 구간 한정).
    const forceAutoScrollBehavior = (on: boolean) => {
      ;[document.documentElement, document.body].forEach((el) => {
        if (on) el.style.setProperty('scroll-behavior', 'auto', 'important')
        else el.style.removeProperty('scroll-behavior')
      })
    }

    // 랜딩 모션 셋업 전체를 gsap.matchMedia 로 일원화한다.
    // - reduce 사용자: 슬라이드 하이재킹/히어로 트윈 없음(네이티브 스크롤), Observer 미생성
    // - 정리: 이 컨텍스트에 기록된 트윈/ScrollTrigger 만 mm.revert() 로 회수
    //   (기존 ScrollTrigger.getAll() 전역 몰살 → 다른 컴포넌트 트리거 오살 문제 제거)
    const mm = gsap.matchMedia()

    mm.add('(prefers-reduced-motion: no-preference)', (ctx) => {
      let ctxAlive = true
      const scrambleRestores: { el: HTMLElement; text: string }[] = []
      let heroTaglineSplit: SplitText | null = null
      let aboutTextSplit: SplitText | null = null

      // 2. 마그네틱 끌림 — 수제 루프(magneticHandlers push 누락으로 리스너 누수)를
      //    공용 유틸로 통합. 리스너/트윈/clearProps 회수는 유틸 cleanup 에 내장.
      const detachMagnetic = attachMagnetic(document.querySelectorAll('.magnetic-target'), {
        strength: 0.4 // 기존 수제 루프와 동일한 끌림 강도 유지
      })

      // 2.5. andrewreff.com Style 3D Mouse Tracking Tilt & Liquid Wave Typography Animation
      const letters = document.querySelectorAll('.gsap-letter')
      const heroSection = mainHeroRef.current

      // Setup initial 3D deep space positions of letters for cinematic opening assembly
      gsap.set(letters, {
        opacity: 0,
        z: -700,
        scale: 0.15,
        rotateX: -85,
        rotateY: (index) => (index - 5.5) * 12,
        color: '#ffffff'
      })

      // Setup initial state for back monolith cinematic reveal
      if (heroZoomImgRef.current) {
        gsap.set(heroZoomImgRef.current, {
          scale: 1.35,
          opacity: 0,
          filter: 'brightness(0.3) blur(15px)'
        })
      }

      const handleMouseMoveTilt = (e: MouseEvent) => {
        if (!heroSection) return
        const rect = heroSection.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        const diffX = e.clientX - centerX
        const diffY = e.clientY - centerY

        // Calculate smooth tilt values (max 22 degrees of immersive 3D tilting)
        const rotateY = (diffX / window.innerWidth) * 35
        const rotateX = -(diffY / window.innerHeight) * 35

        letters.forEach((el, index) => {
          // Apply micro stagger factor for laggy liquid waves dynamics
          const factor = 0.8 + index * 0.05
          gsap.to(el, {
            rotateX: rotateX * factor,
            rotateY: rotateY * factor,
            x: (diffX * 0.04) * factor,
            y: (diffY * 0.04) * factor,
            z: 35 * factor,
            duration: 0.7,
            ease: 'power2.out',
            overwrite: 'auto'
          })
        })
      }

      const handleMouseLeaveTilt = () => {
        letters.forEach((el) => {
          gsap.to(el, {
            rotateX: 0,
            rotateY: 0,
            x: 0,
            y: 0,
            z: 0,
            duration: 1.6,
            ease: 'elastic.out(1, 0.6)',
            overwrite: 'auto'
          })
        })
      }

      // good-fella.com Style Y-Axis 360 Spin on direct character hover
      const spinHandlers: { el: Element; enter: () => void; leave: () => void }[] = []

      letters.forEach((el) => {
        const onMouseEnter = () => {
          gsap.to(el, {
            rotateY: '+=360',
            color: '#222222',
            duration: 0.9,
            ease: 'back.out(1.8)',
            overwrite: 'auto'
          })
        }
        const onMouseLeave = () => {
          gsap.to(el, {
            color: '#ffffff',
            duration: 0.8,
            ease: 'power2.out',
            overwrite: 'auto'
          })
        }
        el.addEventListener('mouseenter', onMouseEnter)
        el.addEventListener('mouseleave', onMouseLeave)
        spinHandlers.push({ el, enter: onMouseEnter, leave: onMouseLeave })
      })

      // Execute Immersive Cinematic Entrance Movie Sequence
      const introTl = gsap.timeline({
        onComplete: () => {
          // Bind dynamic mouse tracking interactions ONLY when the opening cinema is perfectly done!
          if (heroSection) {
            heroSection.addEventListener('mousemove', handleMouseMoveTilt)
            heroSection.addEventListener('mouseleave', handleMouseLeaveTilt)
          }

          // Initialize ScrollTrigger only AFTER the cinematic intro has perfectly assembled!
          // This ensures ScrollTrigger memorizes the fully assembled state (opacity: 1, z: 0) as its starting point,
          // thereby preventing letters from vanishing when users scroll back up to the top!
          // onComplete 는 컨텍스트 동기 실행 밖이므로 ctx.add 로 감싸 heroTl(+ScrollTrigger)을
          // 이 컨텍스트 스코프에 기록한다 — mm.revert() 시 함께 정리된다.
          ctx.add(() => {
            if (!mainHeroRef.current) return
            // Enable 3D perspective context
            gsap.set(mainHeroRef.current, { perspective: 1200 })

            const heroTl = gsap.timeline({
              scrollTrigger: {
                trigger: mainHeroRef.current,
                start: 'top top',
                end: 'bottom top',
                scrub: 1.8,
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
                ease: 'power2.out'
              }, 0)
            }

            const grid = mainHeroRef.current.querySelector('.hero-bg-grid')
            if (grid) {
              heroTl.to(grid, {
                scale: 1.15,
                opacity: 0.6,
                duration: 1.5,
                ease: 'power2.out'
              }, 0)
            }

            // 3.5. Immersive 3D Splitted Letters ScrollTrigger Scatter Effect (Fine-tuned for extreme softness)
            letters.forEach((el, index) => {
              const centerOffset = index - 5.5
              const targetX = centerOffset * 65
              const targetY = -120 - (Math.abs(centerOffset) * 20)
              const targetZ = 450 - (Math.abs(centerOffset) * 80)
              const targetRotY = centerOffset * 15
              const targetRotX = 45

              heroTl.to(el, {
                x: targetX,
                y: targetY,
                z: targetZ,
                rotateX: targetRotX,
                rotateY: targetRotY,
                opacity: 0,
                scale: 1.5,
                duration: 1.5,
                ease: 'power1.out'
              }, 0)
            })

            const tag = mainHeroRef.current.querySelector('.hero-kinetic-tag')
            if (tag) {
              heroTl.to(tag, {
                yPercent: -20,
                opacity: 0,
                duration: 0.8,
                ease: 'power1.in'
              }, 0)
            }
          })
        }
      })

      // 1. Reveal cinematic monolith (fog dissolves, zoom in)
      if (heroZoomImgRef.current) {
        introTl.to(heroZoomImgRef.current, {
          scale: 1,
          opacity: 0.9,
          filter: 'brightness(0.9) blur(0px)',
          duration: 2.4,
          ease: 'power3.out'
        }, 0)
      }

      // 2. Splitted letters kinetic 3D assembly from deep space (staggered elastic snap)
      introTl.to(letters, {
        opacity: 1,
        z: 0,
        scale: 1,
        rotateX: 0,
        rotateY: 0,
        duration: 1.9,
        stagger: {
          each: 0.08,
          from: 'center'
        },
        ease: 'elastic.out(0.9, 0.7)'
      }, 0.2)

      // 3. 한국어 태그라인 SplitText 워드 마스크 리빌 + 모노 라벨 ScrambleText 디코드 (인트로 말미)
      //    (reduce 사용자는 이 컨텍스트 자체가 실행되지 않아 즉시 평문 렌더)
      const heroTaglineEl = mainHeroRef.current?.querySelector<HTMLElement>('.hero-tagline')
      const heroMonoEl = mainHeroRef.current?.querySelector<HTMLElement>('.hero-mono-label')

      // 첫 방문에는 BlockBuildIntro 벽돌 벽이 ~3초까지 화면을 덮는다(완료 시점에 bc_intro_seen 저장).
      // 벽 뒤에서 리빌이 끝나버리지 않게, 인트로가 재생될 방문에는 시작점을 벽이 걷힌 뒤로 민다.
      let introSeen = true
      try { introSeen = !!sessionStorage.getItem('bc_intro_seen') } catch { }
      const taglineAt = introSeen ? 1.8 : 3.2
      const monoAt = introSeen ? 2.4 : 3.8

      if (heroTaglineEl) {
        // SplitText 3.15: mask:'words' 지원 확인됨 (각 워드를 overflow:clip 래퍼로 감쌈)
        heroTaglineSplit = new SplitText(heroTaglineEl, { type: 'words', mask: 'words' })
        gsap.set(heroTaglineSplit.words, { yPercent: 110 })
        introTl.to(heroTaglineSplit.words, {
          yPercent: 0,
          duration: 0.9,
          stagger: 0.07,
          ease: 'power3.out',
          onComplete: () => {
            // 마스크 래퍼(overflow:clip)가 남으면 textShadow 글로우가 워드 사각형으로 잘리는
            // 아티팩트가 상시 노출된다 — 리빌 종료 즉시 원본 DOM으로 복원.
            heroTaglineSplit?.revert()
            heroTaglineSplit = null
          }
        }, taglineAt)
      }

      if (heroMonoEl) {
        const heroMonoText = heroMonoEl.textContent || ''
        scrambleRestores.push({ el: heroMonoEl, text: heroMonoText })
        gsap.set(heroMonoEl, { autoAlpha: 0 })
        introTl.to(heroMonoEl, { autoAlpha: 1, duration: 0.2, ease: 'none' }, monoAt)
        introTl.to(heroMonoEl, {
          duration: 1.0,
          scrambleText: { text: heroMonoText, chars: 'upperCase', speed: 0.4 }
        }, monoAt)
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

          // 국문 헤딩+본문은 아래 7.25의 SplitText 라인 마스크 리빌이 담당하므로
          // 통짜 박스 페이드는 CTA 버튼 행에만 남긴다. (reduce: 컨텍스트 미실행 → 즉시 표시)
          const ctaRow = content.querySelector('.about-cta-row')
          if (ctaRow) {
            gsap.fromTo(ctaRow,
              { opacity: 0, y: 30 },
              {
                opacity: 1,
                y: 0,
                duration: 1,
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

        // 7.25. 국문 헤딩+본문 라인 마스크 리빌 — 한글 줄바꿈이 폰트 메트릭에 좌우되므로
        //       document.fonts.ready 이후에 분할해야 라인 경계가 정확하다.
        const aboutTextTargets = Array.from(
          aboutSection.querySelectorAll<HTMLElement>('.about-content-box h2 > span, .about-content-box p')
        )
        if (aboutTextTargets.length) {
          document.fonts.ready.then(() => {
            // 폰트 로딩 완료 전에 컨텍스트가 정리(라우트 이탈·미디어 토글)되면 생성 스킵
            if (!ctxAlive) return
            // 비동기 생성물도 ctx.add 로 감싸 트윈+ScrollTrigger 를 컨텍스트에 기록
            ctx.add(() => {
              aboutTextSplit = new SplitText(aboutTextTargets, { type: 'lines', mask: 'lines' })
              gsap.set(aboutTextSplit.lines, { yPercent: 110 })
              gsap.to(aboutTextSplit.lines, {
                yPercent: 0,
                duration: 1,
                stagger: 0.07,
                ease: 'power4.out',
                scrollTrigger: {
                  trigger: aboutSection,
                  start: 'top 75%',
                  toggleActions: 'play none none reverse'
                }
              })
            })
          })
        }
      }

      // 7.5. 텔레메트리 라벨 ScrambleText 디코드 — 섹션 진입 시 블록문자에서 실제 텍스트로 1회 복원.
      //      bc-pixel-num(픽셀폰트, 숫자 전용 글리프) 요소는 블록문자 대신 숫자 문자로 스크램블해
      //      최종값이 실제 값과 정확히 일치한 채 끝난다.
      //      (HOVER/TAP 안내문은 포인터 타입별 스팬 2개가 각각 스크램블 — 숨은 쪽은 display:none 이라 무해)
      document.querySelectorAll<HTMLElement>('.tele-scramble').forEach((el) => {
        const finalText = el.textContent || ''
        if (!finalText.trim()) return
        scrambleRestores.push({ el, text: finalText })
        gsap.to(el, {
          duration: 1.1,
          scrambleText: {
            text: finalText,
            chars: el.classList.contains('bc-pixel-num') ? '0123456789' : '▓▒░<>/[]',
            speed: 0.4
          },
          scrollTrigger: {
            trigger: el.closest('section') || el,
            start: 'top 70%',
            once: true
          }
        })
      })

      // --- 8. Premium Slide Scrolling Controller — Observer + ScrollToPlugin 판 ---
      // 기존 수제 wheel/touchstart/touchmove preventDefault + setTimeout(1000) 잠금을
      // Observer 로 대체. 잠금 해제는 추정치가 아니라 스크롤 트윈 onComplete 에 정확히 동기화.
      let isAnimating = false
      let scrollTween: gsap.core.Tween | null = null

      const scrollToIdx = (idx: number) => {
        if (idx < 0 || idx >= sections.length || isAnimating) return
        const target = document.querySelector(sections[idx]) as HTMLElement | null
        if (!target) return
        isAnimating = true
        currentIdxRef.current = idx
        setCurrentIdx(idx)

        forceAutoScrollBehavior(true)
        const unlock = () => {
          isAnimating = false
          forceAutoScrollBehavior(false)
        }
        // 내비게이션 시점(비동기)에 생성되는 트윈이라 컨텍스트에 기록되지 않음 → 직접 보관/정리
        scrollTween = gsap.to(window, {
          scrollTo: { y: target, autoKill: false },
          duration: 1,
          ease: 'power2.inOut',
          onComplete: unlock,
          onInterrupt: unlock
        })
      }

        // Expose scrollToIdx for JSX elements (side indicators & footer circular button)
        ; (window as any).scrollToLandingIdx = scrollToIdx

      // 기존 상태머신 그대로 이식: 3개 섹션 + 스태프 섹션 트랩 + 푸터 드로어 2단계 열기/닫기.
      // 드로어 토글도 잠금을 건다 — Observer 는 한 제스처(관성 플릭) 동안 onUp/onDown 을
      // 연속 발화하므로, 잠금 없이는 '드로어 닫기→섹션 복귀' 2단계가 한 플릭에 붕괴된다.
      let drawerLockTimer: ReturnType<typeof setTimeout> | null = null
      const lockForDrawer = () => {
        isAnimating = true
        if (drawerLockTimer) clearTimeout(drawerLockTimer)
        // 드로어 CSS 트랜지션 길이에 맞춘 해제 — 같은 제스처의 잔여 발화를 흡수
        drawerLockTimer = setTimeout(() => { isAnimating = false }, 900)
      }
      const navigate = (dir: 1 | -1) => {
        if (isAnimating) return

        // Last section (#staff-section) Pop/Push Drawer logic
        if (currentIdxRef.current === 2) {
          if (dir === 1) {
            // 아래 방향: 푸터가 닫혀 있으면 팝업(이미 열려 있으면 트랩 유지)
            if (!showFooterPopupRef.current) {
              toggleFooterPopup(true)
              lockForDrawer()
            }
          } else if (showFooterPopupRef.current) {
            // 위 방향 1단계: 푸터부터 닫는다 (잠금으로 같은 플릭의 2단계 연쇄 차단)
            toggleFooterPopup(false)
            lockForDrawer()
          } else {
            // 위 방향 2단계: Stage 2 로 복귀
            scrollToIdx(1)
          }
          return
        }

        scrollToIdx(currentIdxRef.current + dir)
      }

      // 휠 + 터치 스와이프를 Observer 하나로 통합(D-2 터치 딜리버러블).
      // wheelSpeed:-1 로 휠 델타를 터치와 같은 의미축으로 정렬(GSAP 공식 섹션 데모 패턴)
      //   → onUp = 다음 섹션(휠다운/스와이프업), onDown = 이전 섹션(휠업/스와이프다운).
      // type 에 'pointer' 는 넣지 않는다 — 데스크톱 마우스 드래그가 섹션 내비로 승격되고
      // preventDefault 가 텍스트 선택까지 차단하는 회귀(구 구현은 휠/터치/키만 하이재킹).
      // tolerance:35 → 구 구현의 터치 임계(40px)와 비슷한 체감 — 탭 중 손가락 드리프트가
      // 슬라이드로 승격되지 않게 한다(휠은 노치당 델타가 커서 영향 없음).
      // lockAxis → 마키 Draggable 가로 드래그 중 세로 오발동 방지.
      const slideObserver = Observer.create({
        type: 'wheel,touch',
        wheelSpeed: -1,
        tolerance: 35,
        preventDefault: true,
        lockAxis: true,
        onUp: () => navigate(1),
        onDown: () => navigate(-1)
      })

      // Observer 는 키보드를 다루지 않음 — 화살표/페이지/스페이스만 얇게 유지해 같은 navigate 로 연결
      const handleKeyDown = (e: KeyboardEvent) => {
        const keys = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Spacebar']
        if (!keys.includes(e.key)) return
        e.preventDefault()
        navigate(e.key === 'ArrowUp' || e.key === 'PageUp' ? -1 : 1)
      }
      window.addEventListener('keydown', handleKeyDown)

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

      // Refresh ScrollTrigger to align all start/end positions perfectly with the snapping offsets
      ScrollTrigger.refresh()

      // 컨텍스트 정리 — 트윈/ScrollTrigger 는 mm.revert() 가 스코프 회수하므로
      // 여기서는 컨텍스트가 모르는 것(리스너·Observer·비동기 트윈·DOM 텍스트)만 되돌린다.
      return () => {
        ctxAlive = false

        slideObserver.kill()
        if (drawerLockTimer) clearTimeout(drawerLockTimer)
        window.removeEventListener('keydown', handleKeyDown)
        linkClickHandlers.forEach(({ el, handler }) => {
          el.removeEventListener('click', handler)
        })

        detachMagnetic()

        if (heroSection) {
          heroSection.removeEventListener('mousemove', handleMouseMoveTilt)
          heroSection.removeEventListener('mouseleave', handleMouseLeaveTilt)
        }

        spinHandlers.forEach(({ el, enter, leave }) => {
          el.removeEventListener('mouseenter', enter)
          el.removeEventListener('mouseleave', leave)
        })

        // 인트로 타임라인(기존 누수분) + 진행 중 스크롤 트윈 명시 정리
        introTl.kill()
        scrollTween?.kill()
        forceAutoScrollBehavior(false)

        // SplitText/ScrambleText 정리 — 라우트 재진입 시 원본 DOM/텍스트로 복원
        if (heroTaglineSplit) {
          gsap.killTweensOf(heroTaglineSplit.words)
          heroTaglineSplit.revert()
        }
        if (aboutTextSplit) {
          gsap.killTweensOf(aboutTextSplit.lines)
          aboutTextSplit.revert()
        }
        scrambleRestores.forEach(({ el, text }) => {
          gsap.killTweensOf(el)
          el.textContent = text
        })

        delete (window as any).scrollToLandingIdx
      }
    })

    // --- 모션 최소화 사용자: 슬라이드 하이재킹/히어로 트윈/Observer 일절 없이 네이티브 스크롤.
    //     사이드 도트·푸터 버튼은 계속 동작해야 하므로 즉시 점프 버전만 노출한다. ---
    mm.add('(prefers-reduced-motion: reduce)', () => {
      const jumpToIdx = (idx: number) => {
        if (idx < 0 || idx >= sections.length) return
        const target = document.querySelector(sections[idx]) as HTMLElement | null
        if (!target) return
        currentIdxRef.current = idx
        setCurrentIdx(idx)
        // 스무스 애니메이션 없이 즉시 점프(전역 smooth CSS 를 구간 무력화)
        forceAutoScrollBehavior(true)
        target.scrollIntoView()
        forceAutoScrollBehavior(false)
      }
        ; (window as any).scrollToLandingIdx = jumpToIdx

      // 네이티브 스크롤로 이동해도 사이드 도트가 현재 섹션을 따라가게 동기화
      // (하이재킹 컨텍스트는 scrollToIdx 가 갱신하지만 여기는 손 스크롤이 주 경로)
      const syncIdxOnScroll = () => {
        const mid = window.scrollY + window.innerHeight / 2
        let nearest = 0
        sections.forEach((sel, i) => {
          const el = document.querySelector(sel) as HTMLElement | null
          if (el && el.offsetTop <= mid) nearest = i
        })
        if (nearest !== currentIdxRef.current) {
          currentIdxRef.current = nearest
          setCurrentIdx(nearest)
        }
      }
      window.addEventListener('scroll', syncIdxOnScroll, { passive: true })

      return () => {
        window.removeEventListener('scroll', syncIdxOnScroll)
        delete (window as any).scrollToLandingIdx
      }
    })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      // 이 이펙트가 만든 컨텍스트만 회수 — 다른 컴포넌트의 ScrollTrigger 는 건드리지 않는다
      mm.revert()
    }
  }, [creators])

  const mergedCreators = creators as any[]

  return (
    <LandingScroll>
      <div
        ref={mainContainerRef}
        className="min-h-screen bg-[#FAF9F5] text-[#1E2022] font-sans overflow-x-hidden selection:bg-black selection:text-white relative cursor-default w-full"
      >

        {/* 🧱 블록 빌드 입장 인트로 (첫 방문 1회) */}
        <BlockBuildIntro />

        {/* 🎯 Premium Dynamic Mix-blend Custom Circle Cursor */}
        <CustomCursor />

        {/* 🧭 Premium Vertical Section Navigation Indicators */}
        <div className="fixed right-6 top-1/2 -translate-y-1/2 text[1px] z-40 hidden md:flex flex-col gap-4">
          {[
            { label: 'Main', idx: 0 },
            { label: 'About Us', idx: 1 },
            { label: 'Creators', idx: 2 }
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
              {/* 타이핑 워드마크 → 브랜드 로고 이미지(CreatorNavbar와 동일 자산) */}
              <Image
                src="/logo_text.png"
                alt="BLOCK CANVAS"
                width={133}
                height={16}
                className="h-3.5 w-auto object-contain"
              />
            </Link>

            <nav className="hidden md:flex items-center gap-8 text-[9px] font-bold text-neutral-400 uppercase tracking-widest pointer-events-auto">
              <Link href="/" className="hover:text-black transition-colors magnetic-target">Main</Link>
              <a href="#about-section" className="hover:text-black transition-colors magnetic-target">About Us</a>
              <TransitionLink href="/explore" className="hover:text-black transition-colors magnetic-target">Explore</TransitionLink>
              <TransitionLink href="/gallery" className="hover:text-black transition-colors magnetic-target">Blueprint</TransitionLink>
            </nav>

            <div className="pointer-events-auto">
              {userProfile ? (
                <UserSidebar
                  userName={userProfile.display_name || userProfile.creator_name}
                  userHandle={userProfile.creator_name}
                  avatarUrl={userProfile.avatar_url || ''}
                  isOwner={true}
                  userRole={userProfile.role || undefined}
                />
              ) : (
                <Link
                  href="/login"
                  className="group relative inline-flex items-center gap-1.5 rounded-full bg-neutral-900 text-[#FAF9F5] text-[10px] font-bold tracking-wide py-2 pl-4 pr-3.5 shadow-sm hover:bg-black hover:shadow-lg transition-all duration-300 magnetic-target"
                >
                  <span>로그인</span>
                  <ArrowRight className="w-3 h-3 transition-transform duration-300 ease-out group-hover:translate-x-0.5" />
                </Link>
              )}
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
                src="/Main_Banner.png"
                alt="BlockCanvas Cinematic Monolith"
                fill
                className="object-cover brightness-90 opacity-90"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-b from-[#FAF9F5]/3 via-transparent to-[#FAF9F5]" />
            </div>
          </div>

          {/* Top spacer to account for header heights */}
          <div className="h-24 md:h-32" />

          <div className="relative z-20 w-full px-6 md:px-12 flex flex-col items-center text-center my-auto">
            <h1 className="hero-kinetic-title text-6xl md:text-9xl lg:text-[10rem] font-black tracking-tighter leading-[0.85] uppercase select-none luxury-text-heavy flex items-center justify-center gap-0.5 md:gap-1.5">
              {"BLOCKCANVAS".split("").map((letter, i) => (
                <span
                  key={i}
                  className="gsap-letter inline-block cursor-default"
                  style={{ display: 'inline-block', transformOrigin: 'bottom center' }}
                >
                  {letter}
                </span>
              ))}
            </h1>

            {/* 한국어 스토리 태그라인 + 텔레메트리 라벨 — 인트로 타임라인 말미에
                SplitText 워드 마스크 리빌 / ScrambleText 디코드로 등장.
                (.hero-kinetic-tag: 기존 heroTl 스크롤 스캐터가 이 래퍼를 페이드아웃)
                ⚠BLOCKCANVAS 위치 고정: absolute(top-full)로 레이아웃에서 분리해 h1이 태그라인
                추가 이전의 센터 위치를 그대로 유지 — 인트로 워드마크와의 핸드오프 정렬 기준.
                가로 정렬은 transform이 아닌 inset-x-0 + flex(GSAP가 wrapper transform을 덮어써도 안전) */}
            <div className="hero-kinetic-tag absolute top-full inset-x-0 z-20 mt-8 md:mt-12 flex flex-col items-center gap-4">
              <p
                className="hero-tagline text-lg md:text-2xl lg:text-[1.75rem] font-semibold tracking-tight text-white/95"
                style={{ textShadow: '0 2px 18px rgba(0,0,0,0.35)' }}
              >
                블록을 쌓아, 나만의 캔버스를 세우다
              </p>
              {/* 'MINECRAFT' 대신 중립 표현 — UI 카피의 Mojang 상표 노출은 정책상 보류 상태(약관에만 비제휴 고지) */}
              <p className="hero-mono-label text-[9px] md:text-[10px] font-mono font-bold uppercase tracking-[0.35em] text-white/55">
                PORTFOLIO PLATFORM FOR BLOCK BUILDERS
              </p>
            </div>
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
            <span className="text-neutral-400 text-[16px] font-bold uppercase tracking-widest mb-4 block flex items-center gap-1.5 font-mono">
              <Compass size={11} className="text-neutral-400 animate-spin" style={{ animationDuration: '6s' }} />
              <span className="tele-scramble">About Us</span>
            </span>

            {/* Heading - Dynamic contrast layout matching pixelnetwork */}
            <h2 className="text-5xl md:text-7xl lg:text-[5.4rem] text-neutral-900 leading-[1.1] tracking-tighter mb-12 w-full">
              <span className="uppercase block luxury-text-heavy-dark select-none">BLOCKCANVAS</span>
              <span className="font-light text-neutral-400 block mt-4 text-3xl md:text-5xl lg:text-[2.8rem] tracking-tight">크리에이터들을 위한 공간</span>
            </h2>

            {/* Core description paragraphs split layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-24 w-full mt-6">
              <p className="text-base md:text-[1.125rem] text-[#333333] font-normal leading-relaxed">
                BlockCanvas는 여러 크리에이터들이 좁은 공간에 머무르지 않고, 더 넓은 세상에서 아티스트로서 온전한 가치를 인정받을 수 있는 혁신적인 커뮤니티를 지향합니다. 크리에이터가 중심이 되어 높은 신뢰도와 상상력을 바탕으로 각 분야 최고의 디자이너들과 함께합니다.
              </p>
              <p className="text-base md:text-[1.125rem] text-[#333333] font-normal leading-relaxed">
                단순한 퀄리티를 넘어 여러 크리에이터가 한데 모여 수 많은 작품들을 남겨 여러 이용자들에게 온전히 다가갈 수 있도록 공간을 제공합니다. 누구나 손쉽게 교류하도록 여러 디자이너에게는 넓은 공간을 크리에이터에게는 다양한 영감을 주는 공간을 제공합니다.
              </p>
            </div>

            {/* Premium call-to-action buttons */}
            <div className="about-cta-row flex flex-row gap-4 items-center mt-12 md:mt-16 w-full pointer-events-auto">
              <TransitionLink
                href="/explore"
                className="rounded-full bg-neutral-900 text-[#FAF9F5] hover:bg-neutral-800 px-8 py-3.5 text-[12px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all duration-300 shadow-sm hover:shadow-lg magnetic-target"
              >
                <Users size={12} />
                <span>explore creators</span>
              </TransitionLink>

              <Link
                href="https://discord.com/invite/xbA5Y5QWf5"
                target="_blank"
                className="rounded-full border border-neutral-900 bg-transparent text-neutral-900 hover:bg-neutral-900 hover:text-[#FAF9F5] px-8 py-3.5 text-[12px] font-bold uppercase tracking-widest transition-all duration-300 magnetic-target"
              >
                <span>Join BlockCanvas</span>
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
            <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight uppercase luxury-text-heavy-dark">
              BlockCanvas Creators
            </h2>
            {/* D-2: 포인터 타입별 안내 카피 — hover 불가(터치) 기기는 TAP 문구로 CSS-only 스왑.
                두 스팬 모두 .tele-scramble 대상이라 보이는 쪽이 스크램블 디코드되고,
                숨은 쪽은 display:none 이라 시각적 영향이 없다. */}
            <p className="text-[10px] md:text-xs text-neutral-400 font-mono mt-2 uppercase tracking-wider block">
              <span className="tele-scramble [@media(hover:none)]:hidden">
                [ HOVER OVER CARDS TO PREVIEW THEIR MASTERPIECES & VIEW PORTFOLIOS ]
              </span>
              <span className="tele-scramble hidden [@media(hover:none)]:inline">
                [ TAP CARDS TO PREVIEW THEIR MASTERPIECES & VIEW PORTFOLIOS ]
              </span>
            </p>
          </div>

          <div className="w-full py-8 border-y border-neutral-200/60 bg-[#FAF9F5]/40 backdrop-blur-sm relative overflow-hidden z-10">
            {/* Technical Telemetry Metadata */}
            <div className="tele-scramble absolute top-2 left-6 text-[7px] text-neutral-400 font-mono font-bold tracking-widest uppercase z-10 pointer-events-none">
              [ TRACK STATUS: ACTIVE // SPEED: 30S_LOOP // RESOLVING_GRID: ON ]
            </div>
            {/* 숫자 파트는 bc-pixel-num(픽셀폰트) 별도 스팬 — 스크램블도 숫자 문자만 사용해 실제 값으로 정확히 종료 */}
            <div className="absolute top-2 right-6 text-[7px] text-neutral-400 font-mono font-bold tracking-widest uppercase z-10 pointer-events-none">
              <span className="tele-scramble">{'[ ACTIVE_BUILDERS: '}</span>
              <span className="tele-scramble bc-pixel-num">{mergedCreators.length}</span>
              <span className="tele-scramble">{' // LATENCY: 0.04MS ]'}</span>
            </div>

            <InfiniteMarquee speed={30}>
              {mergedCreators.map((creator, index) => {
                const avatarSrc = creator.avatar_url || '/default_avatar.png'
                const bannerSrc = creator.portfolios?.banner_url || '/default_banner.png'

                return (
                  <div
                    key={creator.id}
                    className="bc-cropmark group relative w-[310px] md:w-[350px] bg-white border border-neutral-200/70 flex flex-col rounded-[32px] transition-all duration-500 ease-out hover:border-black hover:-translate-y-2 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] pointer-events-auto z-10"
                  >
                    {/* Banner Image Area - Acts as the Portfolio Cover Banner (Elegant: h-[170px])
                        카드의 overflow-hidden은 bc-cropmark(모서리 밖 재단선)를 잘라내므로
                        상단 라운드 클리핑을 배너 컨테이너로 이관 (시각 결과 동일) */}
                    <div className="relative w-full h-[170px] bg-neutral-100 overflow-hidden rounded-t-[32px]">
                      <Image
                        src={bannerSrc}
                        alt="User Banner"
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-1000 brightness-95"
                      />

                      {/* Dark gradient mask on top of banner for tech look */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/5 pointer-events-none" />

                      {/* Member sequence number at the top right (숫자/라틴 전용 → 픽셀 뉴메럴) */}
                      <div className="bc-pixel-num absolute top-4 right-4 text-white/50 text-[8px] font-bold">
                        #{String(index + 1).padStart(2, '0')}
                      </div>
                    </div>

                    {/* Avatar overlapping banner bottom boundary - Render Avatar with custom 3D placeholder if empty */}
                    <div className="absolute top-[130px] left-1/2 -translate-x-1/2 z-20">
                      <div className="relative w-[90px] h-[90px] rounded-full flex items-center justify-center bg-white text-white font-black text-xl border-4 border-white shadow-[0_6px_16px_rgba(0,0,0,0.12)] group-hover:scale-105 transition-transform duration-500 overflow-hidden">
                        <Image src={avatarSrc} alt={creator.display_name} fill className="object-cover" />
                        {/* Interactive ring overlay */}
                        <div className="absolute inset-0 rounded-full border-2 border-white/20 opacity-0 group-hover:opacity-100 animate-spin duration-1000 pointer-events-none" style={{ animationDuration: '3s' }} />
                      </div>
                    </div>

                    {/* Content Body - Perfectly balanced layout padding */}
                    <div className="pt-16 px-6 pb-6 flex flex-col justify-between flex-grow text-center">
                      <div className="mb-4">
                        <h3 className="text-lg font-black text-black tracking-tight group-hover:text-[#3b82f6] transition-colors">{creator.display_name}</h3>
                      </div>

                      {/* Premium action button at the bottom */}
                      <div className="w-full">
                        {/* 서브도메인 점프를 위해 절대 URL + 일반 <a> 사용.
                            protocol/baseDomain 은 state 라 SSR·hydration 이 일치한다. */}
                        <a
                          href={`${protocol}//${creator.creator_name}.${baseDomain}`}
                          className="text-[9px] font-black text-black hover:bg-neutral-900 hover:text-[#FAF9F5] transition-all inline-flex items-center gap-1 justify-center py-2.5 px-4 border border-neutral-200 rounded-full w-full hover:border-black transition-all duration-300 magnetic-target"
                        >
                          <span>EXPLORE CANVAS</span>
                          <ArrowRight size={9} className="group-hover:translate-x-0.5 transition-transform duration-300" />
                        </a>
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
                      <TransitionLink
                        href="/explore"
                        className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-[#222222] group transition-all text-[#CCCCCC] hover:text-white text-xs cursor-pointer focus:outline-none"
                      >
                        <span className="font-semibold">Explore Platform</span>
                        <span className="text-[#666666] group-hover:text-white transition-colors text-sm">→</span>
                      </TransitionLink>
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
                      <a
                        href="https://discord.gg/xbA5Y5QWf5"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-[#222222] group transition-all text-[#CCCCCC] hover:text-white text-xs cursor-pointer"
                      >
                        <span className="font-semibold">Discord</span>
                        <span className="text-[#666666] group-hover:text-white transition-colors text-xs">↗</span>
                      </a>
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
                    <Image
                      src="/logo_text_white.png"
                      alt="BLOCK CANVAS"
                      width={133}
                      height={16}
                      className="h-4 w-auto object-contain"
                    />
                    <span className="font-black text-base text-[#FF424D] leading-none">.</span>
                  </div>
                  <p className="text-[#666666] text-[10px] font-medium">© 2026 BlockCanvas Studio. All rights reserved.</p>
                  <div className="flex items-center gap-3 text-[10px] font-semibold text-[#888888] mt-2 select-none">
                    <Link href="/privacy" className="text-white hover:underline font-black">
                      개인정보처리방침
                    </Link>
                    <span>|</span>
                    <Link href="/terms" className="text-white hover:underline font-black">
                      이용약관
                    </Link>
                  </div>
                  <p className="text-[#444444] text-[8px] mt-2 font-medium max-w-xl leading-relaxed text-center opacity-40">
                    Open Source Licenses: Next.js, React, Tailwind CSS, Framer Motion, GSAP, Prisma, Radix UI, Lucide, Lenis, Animate UI.
                  </p>
                </div>
              </div>

            </div>
          </footer>
        </section>

      </div>
    </LandingScroll>
  )
}
