'use client'

import React, { useEffect, useRef } from 'react'
import { ReactLenis, useLenis } from '@studio-freight/react-lenis'
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

  // 1. 관리자 대시보드(/adminpage) 라우트에서는 스무스 스크롤러를 완벽 배제하여
  // 내부 오버플로우 스크롤(overflow-auto)이 브라우저 순정 그대로 가장 자연스럽고 신속하게 동작 보장!
  const isAdminPage = pathname?.startsWith('/adminpage')

  useEffect(() => {
    if (isAdminPage) return
    
    if (typeof window !== 'undefined') {
      window.history.scrollRestoration = 'manual'
      // Next.js soft navigation 이동 시 잔존할 수 있는 모달 스크롤 잠금(overflow: hidden)을 강제 박멸
      document.body.style.removeProperty('overflow')
      document.body.style.overflow = ''
      document.documentElement.style.removeProperty('overflow')
      document.documentElement.style.overflow = ''
    }
    
    if (lenis) {
      if (typeof window !== 'undefined') {
        (window as any).lenis = lenis
      }
      // 페이지 이동 즉시 정지 상태였을 수 있는 스크롤러를 강제 깨워 동작 보증
      lenis.start()
      
      const prevPath = prevPathnameRef.current
      
      // 브라우저 실시간 window.location.pathname 및 넥스트 pathname, 직전 경로를 전방위 입체 센싱!
      const currentRealLocation = typeof window !== 'undefined' ? window.location.pathname : ''
      const isProjectModalTransition = 
        pathname.includes('/project/') || 
        prevPath.includes('/project/') || 
        currentRealLocation.includes('/project/')
      
      console.log('--- [DEBUG] SMOOTH SCROLL ROUTE CHANGE ---')
      console.log('pathname (Next.js):', pathname)
      console.log('prevPath (Stored):', prevPath)
      console.log('currentRealLocation (Real window):', currentRealLocation)
      console.log('isProjectModalTransition (Is Modal Active/Toggle):', isProjectModalTransition)
      
      if (!isProjectModalTransition) {
        console.log('🚨 SCROLLING TO TOP TRIGGERED!')
        lenis.scrollTo(0, { immediate: true })
      } else {
        console.log('🛡️ SCROLLING TO TOP BLOCKED!')
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
    
    // 직전 경로 저장하여 다음 렌더링에 참조
    prevPathnameRef.current = pathname
  }, [pathname, lenis])

  useEffect(() => {
    // Synchronize Lenis with GSAP ScrollTrigger
    const updateScrollTrigger = (time: number) => {
      ScrollTrigger.update()
    }

    gsap.ticker.add(updateScrollTrigger)

    return () => {
      gsap.ticker.remove(updateScrollTrigger)
    }
  }, [])

  if (isAdminPage) {
    return <div className={className}>{children}</div>
  }

  return (
    <ReactLenis root={isRoot} className={className} options={{ lerp: 0.15, wheelMultiplier: 1.2, smoothWheel: true }}>
      {children}
    </ReactLenis>
  )
}
