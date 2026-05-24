'use client'

import React, { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)
  const [isHovering, setIsHovering] = useState(false)

  useEffect(() => {
    const cursor = cursorRef.current
    if (!cursor) return

    // High performance cursor tracking
    const xTo = gsap.quickTo(cursor, 'x', { duration: 0.05, ease: 'power3' })
    const yTo = gsap.quickTo(cursor, 'y', { duration: 0.05, ease: 'power3' })

    const moveCursor = (e: MouseEvent) => {
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
        target.closest('.magnetic') !== null

      setIsHovering(isInteractive)
    }

    window.addEventListener('mousemove', moveCursor)
    window.addEventListener('mouseover', handleMouseOver)

    return () => {
      window.removeEventListener('mousemove', moveCursor)
      window.removeEventListener('mouseover', handleMouseOver)
    }
  }, [])

  return (
    <div
      ref={cursorRef}
      className={`fixed top-0 left-0 w-4 h-4 bg-white mix-blend-difference rounded-full pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2 transition-transform duration-300 ease-out ${isHovering ? 'scale-[4] opacity-50' : 'scale-100 opacity-100'
        }`}
    />
  )
}
