'use client'

import React, { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)
  const [enabled, setEnabled] = useState(false)

  // 터치/coarse 포인터(모바일·태블릿) 기기에서는 커스텀 커서를 비활성화한다.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(pointer: coarse)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setEnabled(true)
  }, [])

  useEffect(() => {
    if (!enabled) return
    const cursor = cursorRef.current
    if (!cursor) return

    // Hide initially to prevent stuck dot on first load
    gsap.set(cursor, { opacity: 0, scale: 0 })

    // High performance cursor tracking
    const xTo = gsap.quickTo(cursor, 'x', { duration: 0.05, ease: 'power3' })
    const yTo = gsap.quickTo(cursor, 'y', { duration: 0.05, ease: 'power3' })

    let isVisible = false

    const moveCursor = (e: MouseEvent) => {
      if (!isVisible) {
        isVisible = true
        gsap.to(cursor, { opacity: 1, scale: 1, duration: 0.15 })
      }
      xTo(e.clientX)
      yTo(e.clientY)
    }

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement

      // Expand cursor on interactive elements
      const isInteractive =
        window.getComputedStyle(target).cursor === 'pointer' ||
        target.closest('a') !== null ||
        target.closest('button') !== null ||
        target.closest('.magnetic') !== null ||
        target.closest('[role="button"]') !== null

      if (isInteractive) {
        gsap.to(cursor, { scale: 3.5, backgroundColor: 'rgba(255, 255, 255, 0.4)', duration: 0.25 })
      } else {
        gsap.to(cursor, { scale: 1, backgroundColor: '#ffffff', duration: 0.25 })
      }
    }

    const handleMouseLeave = () => {
      isVisible = false
      gsap.to(cursor, { opacity: 0, scale: 0, duration: 0.15 })
    }

    const handleMouseEnter = () => {
      isVisible = true
      gsap.to(cursor, { opacity: 1, scale: 1, duration: 0.15 })
    }

    window.addEventListener('mousemove', moveCursor)
    window.addEventListener('mouseover', handleMouseOver)
    document.documentElement.addEventListener('mouseleave', handleMouseLeave)
    document.documentElement.addEventListener('mouseenter', handleMouseEnter)

    return () => {
      window.removeEventListener('mousemove', moveCursor)
      window.removeEventListener('mouseover', handleMouseOver)
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave)
      document.documentElement.removeEventListener('mouseenter', handleMouseEnter)
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <div
      ref={cursorRef}
      className="fixed top-0 left-0 w-3.5 h-3.5 bg-white mix-blend-difference rounded-full pointer-events-none z-[99999] -translate-x-1/2 -translate-y-1/2 shadow-[0_0_10px_rgba(255,255,255,0.2)]"
      style={{ willChange: 'transform, opacity', opacity: 0 }}
    />
  )
}
