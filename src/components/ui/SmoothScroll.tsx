'use client'

import React, { useEffect, useRef } from 'react'
import { ReactLenis, useLenis } from 'lenis/react'
import 'lenis/dist/lenis.css'
import { usePathname } from 'next/navigation'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

export default function SmoothScroll({ children, isRoot = true, className }: { children: any, isRoot?: boolean, className?: string }) {
  const pathname = usePathname()
  const lenis = useLenis()
  const prevPathnameRef = useRef<string>('')
  const [isMounted, setIsMounted] = React.useState(false)
  const [reducedMotion, setReducedMotion] = React.useState(false)

  // 1. 관리자 대시보드(/adminpage) 라우트에서는 스무스 스크롤러를 완벽 배제하여
  // 내부 오버플로우 스크롤(overflow-auto)이 브라우저 순정 그대로 가장 자연스럽고 신속하게 동작 보장!
  const isAdminPage = pathname?.startsWith('/adminpage')
  const isLandingPage = pathname === '/'

  useEffect(() => {
    setIsMounted(true)
    if (typeof window !== 'undefined' && window.matchMedia) {
      setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    }
    if (!isRoot || isAdminPage || isLandingPage) return
    
    if (typeof window !== 'undefined') {
      window.history.scrollRestoration = 'manual'
      // Next.js soft navigation 이동 시 잔존할 수 있는 모달 스크롤 잠금(overflow: hidden)을 강제 박멸
      document.body.style.removeProperty('overflow')
      document.body.style.overflow = ''
      document.documentElement.style.removeProperty('overflow')
      document.documentElement.style.overflow = ''
    }
    
    // 직전 경로를 먼저 확보하고 즉시 갱신 — 기존에는 lenis 존재 시 cleanup return에 가로막혀
    // 갱신 라인이 영원히 실행되지 않아 prevPath가 항상 빈 문자열이던 버그가 있었음
    const prevPath = prevPathnameRef.current
    prevPathnameRef.current = pathname

    if (lenis) {
      if (typeof window !== 'undefined') {
        (window as any).lenis = lenis
      }
      // 페이지 이동 즉시 정지 상태였을 수 있는 스크롤러를 강제 깨워 동작 보증
      lenis.start()

      // 브라우저 실시간 window.location.pathname 및 넥스트 pathname, 직전 경로를 전방위 입체 센싱!
      const currentRealLocation = typeof window !== 'undefined' ? window.location.pathname : ''
      const isProjectModalTransition = 
        pathname.includes('/project/') || 
        prevPath.includes('/project/') || 
        currentRealLocation.includes('/project/')
      
      if (!isProjectModalTransition) {
        lenis.scrollTo(0, { immediate: true })
      }

      // 페이지 전환에 의한 바디 높이 변화 캐시 미갱신 스크롤락 예방용 리사이즈 콤보!
      // 마운트 시점 즉각 리사이징
      lenis.resize()
      ScrollTrigger.refresh()

      // 리액트 DOM Hydration 렌더링 딜레이를 고려하여 120ms 후 추가 정밀 재계측 확정 스탬프!
      const timer = setTimeout(() => {
        lenis.resize()
        ScrollTrigger.refresh()
      }, 120)

      return () => clearTimeout(timer)
    }
  }, [pathname, lenis])

  useEffect(() => {
    // Lenis 공식 권장 패턴: 스크롤 이벤트 시에만 ScrollTrigger 갱신
    // (기존: gsap.ticker로 매 프레임 무조건 update — 스크롤이 없어도 상시 비용 발생)
    if (!lenis) return

    lenis.on('scroll', ScrollTrigger.update)

    return () => {
      lenis.off('scroll', ScrollTrigger.update)
    }
  }, [lenis])

  if (!isMounted || isAdminPage || reducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <ReactLenis root={isRoot} className={className} options={{ lerp: 0.15, wheelMultiplier: 1.2, smoothWheel: true }}>
      {children}
    </ReactLenis>
  )
}
