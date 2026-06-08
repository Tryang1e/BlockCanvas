'use client'

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

// 활성화된 효과 1개만 lazy-load 한다 (18종 전부를 번들에 포함하지 않도록).
const effectMap: Record<string, React.ComponentType<any>> = {
  floating_blocks: dynamic(() => import('./floating-blocks'), { ssr: false }),
  moving_grid: dynamic(() => import('./moving-grid'), { ssr: false }),
  css_stars: dynamic(() => import('./css-stars'), { ssr: false }),
  aurora: dynamic(() => import('./aurora-glow'), { ssr: false }),
  mesh_gradient: dynamic(() => import('./mesh-gradient'), { ssr: false }),
  grain: dynamic(() => import('./grain-overlay'), { ssr: false }),
  retro_grid: dynamic(() => import('./retro-grid'), { ssr: false }),
  particle_network: dynamic(() => import('./particle-network'), { ssr: false }),
  gravity_stars: dynamic(() => import('./gravity-stars'), { ssr: false }),
  fireworks: dynamic(() => import('./fireworks'), { ssr: false }),
  flickering_grid: dynamic(() => import('./flickering-grid'), { ssr: false }),
  shooting_stars: dynamic(() => import('./shooting-stars'), { ssr: false }),
  wavy_waves: dynamic(() => import('./wavy-background'), { ssr: false }),
  animate_bubble: dynamic(() => import('./animate-bubble').then((m) => m.BubbleBackground), { ssr: false }),
  animate_fireworks: dynamic(() => import('./animate-fireworks').then((m) => m.FireworksBackground), { ssr: false }),
  animate_gradient: dynamic(() => import('./animate-gradient').then((m) => m.GradientBackground), { ssr: false }),
  animate_gravity_stars: dynamic(() => import('./animate-gravity-stars').then((m) => m.GravityStarsBackground), { ssr: false }),
  animate_hexagon: dynamic(() => import('./animate-hexagon').then((m) => m.HexagonBackground), { ssr: false }),
  animate_stars: dynamic(() => import('./animate-stars').then((m) => m.StarsBackground), { ssr: false }),
}

// 모바일/저사양에서 비활성화할 "무거운" 캔버스(rAF) 기반 효과들
const HEAVY_EFFECTS = new Set<string>([
  'particle_network', 'gravity_stars', 'fireworks', 'flickering_grid', 'shooting_stars',
  'wavy_waves', 'animate_bubble', 'animate_fireworks', 'animate_gravity_stars',
  'animate_hexagon', 'animate_stars',
])

interface DynamicBackgroundProps {
  effect?: string | null
}

export default function DynamicBackground({ effect }: DynamicBackgroundProps) {
  const [activeEffect, setActiveEffect] = useState<string | null>(effect || 'none')
  const [pageVisible, setPageVisible] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setActiveEffect(effect || 'none')
  }, [effect])

  // 테마 에디터의 실시간 효과 변경 이벤트 수신
  useEffect(() => {
    const handleEffectChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      setActiveEffect(customEvent.detail || 'none')
    }
    window.addEventListener('theme-effect-change', handleEffectChange)
    return () => window.removeEventListener('theme-effect-change', handleEffectChange)
  }, [])

  // 탭이 비활성(백그라운드)일 때 배경을 언마운트 → rAF/캔버스 정지로 배터리·CPU 절약
  useEffect(() => {
    const onVisibility = () => setPageVisible(!document.hidden)
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // 모션 최소화를 선호하는 사용자에게는 장식용 배경 애니메이션을 끈다 (접근성)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // 모바일/좁은 화면 감지 (무거운 배경 비활성화용)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(max-width: 768px)')
    setIsMobile(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  if (!activeEffect || activeEffect === 'none') return null
  if (reducedMotion || !pageVisible) return null
  // 모바일/저사양에서는 무거운 캔버스 배경을 건너뛴다 (가벼운 CSS 효과는 유지)
  if (isMobile && HEAVY_EFFECTS.has(activeEffect)) return null

  const Effect = effectMap[activeEffect]
  if (!Effect) return null

  // animate_bubble 만 interactive prop을 사용
  return <Effect {...(activeEffect === 'animate_bubble' ? { interactive: true } : {})} />
}
