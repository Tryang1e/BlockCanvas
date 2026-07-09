'use client'

import React, { useMemo, useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

/**
 * BlockCanvas 시그니처: 픽셀 디졸브 오버레이 (마인크래프트 청크 로딩의 2D 번역).
 * active가 켜지면 블록 셀이 무작위 순서로 착착 채워지며 배경을 덮고, 꺼지면 반대로 걷힌다.
 * 카드 호버 오버레이의 "배경판"으로 콘텐츠 뒤(z축 아래)에 깔아 쓴다.
 *
 * 사용 예:
 *   <div onMouseEnter={...} onMouseLeave={...} className="relative">
 *     <PixelDissolve active={hovered} className="z-10" />
 *     <div className="relative z-20 ...">오버레이 콘텐츠</div>
 *   </div>
 */
export default function PixelDissolve({
  active,
  rows = 6,
  cols = 8,
  color = 'rgba(30, 32, 34, 0.92)',
  className = '',
}: {
  active: boolean
  rows?: number
  cols?: number
  color?: string
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cells = useMemo(() => Array.from({ length: rows * cols }), [rows, cols])

  useGSAP(
    () => {
      if (!containerRef.current) return
      const targets = containerRef.current.children

      const reducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

      if (reducedMotion) {
        // 모션 최소화: 셀 스태거 없이 단순 페이드
        gsap.to(targets, { opacity: active ? 1 : 0, duration: 0.15, overwrite: 'auto' })
        return
      }

      if (active) {
        gsap.to(targets, {
          opacity: 1,
          duration: 0.14,
          ease: 'steps(1)', // 블록은 서서히 나타나지 않는다 — 셀 단위 즉시 점등
          overwrite: 'auto',
          stagger: { each: 0.011, grid: [rows, cols], from: 'random' },
        })
      } else {
        gsap.to(targets, {
          opacity: 0,
          duration: 0.1,
          ease: 'steps(1)',
          overwrite: 'auto',
          stagger: { each: 0.006, grid: [rows, cols], from: 'random' },
        })
      }
    },
    { dependencies: [active, rows, cols], scope: containerRef }
  )

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 grid ${className}`}
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
    >
      {cells.map((_, i) => (
        <div key={i} style={{ backgroundColor: color, opacity: 0 }} />
      ))}
    </div>
  )
}
